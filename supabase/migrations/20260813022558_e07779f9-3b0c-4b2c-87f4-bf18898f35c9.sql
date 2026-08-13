-- FIX RNF-07 (re-auditoría v13.544.2): la RPC aprobar_factura_proveedor no era
-- la última línea. La política RLS de captura permite UPDATE directo sobre
-- proveedor_facturas a admin/contador/auxiliar_contable sin restricción de
-- columnas, y el guard existente sólo vigila `estado`, no `estado_aprobacion`.
-- Se cierra con trigger BEFORE UPDATE OF estado_aprobacion + marca de sesión
-- app.aprobando_cxp (mismo patrón que app.cancelando_cxp).

CREATE OR REPLACE FUNCTION public.guard_aprobacion_proveedor_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado_aprobacion IS NOT DISTINCT FROM OLD.estado_aprobacion THEN
    RETURN NEW;
  END IF;

  -- Volver a 'pendiente' (re-aprobación tras editar la factura) no otorga
  -- aprobación: se permite por el canal normal de edición.
  IF NEW.estado_aprobacion = 'pendiente'::public.estado_aprobacion_factura_proveedor THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.aprobando_cxp', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'LC_CXP_APROBACION_DIRECTA: use aprobar_factura_proveedor()'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_aprobacion_proveedor_factura() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_aprobacion_proveedor_factura ON public.proveedor_facturas;
CREATE TRIGGER trg_guard_aprobacion_proveedor_factura
  BEFORE UPDATE OF estado_aprobacion ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public.guard_aprobacion_proveedor_factura();

-- RPC con la marca de sesión alrededor de sus UPDATE de aprobación.
-- Cuerpo idéntico al vigente salvo los dos set_config.
CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL::text)
 RETURNS proveedor_facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_es_admin boolean;
  v_desvinculo jsonb := '{}'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede aprobar ni rechazar facturas de proveedor.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin'])
  ) INTO v_es_admin;

  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_row.organization_id
          AND om.user_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = '42501';
  END IF;

  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;

  -- SoD: quien capturó no aprueba su propia factura (salvo administradores)
  IF p_aprobar
     AND v_row.created_by IS NOT NULL
     AND v_row.created_by = v_uid
     AND NOT v_es_admin
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: No puedes aprobar una factura que tú mismo capturaste. Pide la aprobación a otra persona.';
  END IF;

  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id);
  END IF;

  -- RNF-07: marca de sesión requerida por trg_guard_aprobacion_proveedor_factura
  -- (transaction-local: se limpia sola si la transacción aborta).
  PERFORM set_config('app.aprobando_cxp', '1', true);

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = NULL
    WHERE id = p_id RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id RETURNING * INTO v_row;

    -- v13.493.0 — el rechazo rompe el vínculo con el embarque: los conceptos de
    -- costo vuelven a quedar pendientes de factura y la factura se cancela.
    v_desvinculo := public._cxp_desvincular_por_rechazo(p_id, p_motivo);
    SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id;
  END IF;

  PERFORM set_config('app.aprobando_cxp', '0', true);

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (
      v_row.organization_id,
      v_uid,
      COALESCE(v_email, ''),
      CASE WHEN p_aprobar THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END,
      'cxp',
      v_row.id,
      'Factura ' || COALESCE(v_row.folio_proveedor,'') || ' de ' || COALESCE(v_row.proveedor_nombre,''),
      jsonb_build_object('motivo', p_motivo, 'total', v_row.total, 'aprobada', p_aprobar)
        || v_desvinculo
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated, service_role;

-- Verificación fail-closed: el trigger debe existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'proveedor_facturas'
      AND t.tgname = 'trg_guard_aprobacion_proveedor_factura'
  ) THEN
    RAISE EXCEPTION 'RNF-07: trigger de guard de aprobación no instalado';
  END IF;
END $$;