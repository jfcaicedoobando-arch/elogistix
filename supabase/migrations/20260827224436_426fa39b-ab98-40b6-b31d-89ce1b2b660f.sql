-- ============================================================
-- Ola 4 — cierre de hallazgos HIGH (auditoría 3): H2, H6, H7
-- ============================================================

-- ---------- H6: FK de organization_id ----------
ALTER TABLE public.proveedor_facturas
  ADD CONSTRAINT proveedor_facturas_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) NOT VALID;
ALTER TABLE public.proveedor_facturas VALIDATE CONSTRAINT proveedor_facturas_organization_id_fkey;

ALTER TABLE public.proveedor_facturas_conceptos
  ADD CONSTRAINT proveedor_facturas_conceptos_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) NOT VALID;
ALTER TABLE public.proveedor_facturas_conceptos VALIDATE CONSTRAINT proveedor_facturas_conceptos_organization_id_fkey;

ALTER TABLE public.pagos_factura
  ADD CONSTRAINT pagos_factura_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) NOT VALID;
ALTER TABLE public.pagos_factura VALIDATE CONSTRAINT pagos_factura_organization_id_fkey;

ALTER TABLE public.pagos_proveedor
  ADD CONSTRAINT pagos_proveedor_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) NOT VALID;
ALTER TABLE public.pagos_proveedor VALIDATE CONSTRAINT pagos_proveedor_organization_id_fkey;

-- ---------- H2: three-way match mínimo en CxP ----------

-- Columnas nuevas. `aprobacion_heredada` nace en true para las filas ya
-- existentes (aprobaciones anteriores a este candado) y en false para las nuevas.
ALTER TABLE public.proveedor_facturas
  ADD COLUMN justificacion_sin_vinculo text,
  ADD COLUMN aprobacion_heredada boolean NOT NULL DEFAULT true;
ALTER TABLE public.proveedor_facturas ALTER COLUMN aprobacion_heredada SET DEFAULT false;

COMMENT ON COLUMN public.proveedor_facturas.justificacion_sin_vinculo IS
  'Ola 4 (H2): motivo escrito al aprobar una factura sin embarque ni costo acordado vinculado.';
COMMENT ON COLUMN public.proveedor_facturas.aprobacion_heredada IS
  'Ola 4 (H2): true en facturas anteriores al candado de respaldo; no se les exige justificación retroactiva.';

-- Umbral por organización (configuracion.compras.umbral_aprobacion_sin_vinculo).
CREATE OR REPLACE FUNCTION public.cxp_umbral_sin_vinculo(p_org uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT CASE
             WHEN NULLIF(c.valor #>> '{}', '') ~ '^[0-9]+(\.[0-9]+)?$'
               THEN (c.valor #>> '{}')::numeric
             ELSE NULL
           END
    FROM public.configuracion c
    WHERE c.organization_id = p_org
      AND c.categoria = 'compras'
      AND c.clave = 'umbral_aprobacion_sin_vinculo'
    LIMIT 1
  ), 50000)::numeric;
$function$;

REVOKE ALL ON FUNCTION public.cxp_umbral_sin_vinculo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxp_umbral_sin_vinculo(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cxp_umbral_sin_vinculo_actual()
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.cxp_umbral_sin_vinculo(public.current_user_org_id());
$function$;

REVOKE ALL ON FUNCTION public.cxp_umbral_sin_vinculo_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxp_umbral_sin_vinculo_actual() TO authenticated, service_role;

-- La validación de aprobación pasa a recibir la justificación.
DROP FUNCTION IF EXISTS public._cxp_validar_aprobacion(uuid);

CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion(p_factura_id uuid, p_justificacion text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_conceptos_count integer;
  v_suma_conceptos numeric(18,4);
  v_suma_cantidades numeric(18,4);
  v_tolerancia numeric(18,4);
  v_diferencia numeric(18,4);
  v_emb_estado text;
  v_emb_org uuid;
  v_origen text;
  v_tiene_xml_lineas boolean;
  v_suma_vinculada numeric(18,4);
  v_comprometido numeric(18,4);
  v_sobrecosto numeric(18,4);
  v_total_mxn numeric(18,4);
  v_umbral numeric;
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_factura_id;
  IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura no existe.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL
  ) INTO v_tiene_xml_lineas;

  IF v_tiene_xml_lineas THEN
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id
        AND concepto_costo_id IS NULL;
  ELSE
    SELECT COUNT(*),
           COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0),
           COALESCE(SUM(COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos, v_suma_cantidades
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id;
  END IF;

  IF v_conceptos_count = 0 THEN
    RAISE EXCEPTION 'LC_CXP_SIN_CONCEPTOS: Captura los conceptos de la factura antes de aprobar.';
  END IF;

  -- Tolerancia de redondeo: medio centavo por unidad de cantidad (el precio
  -- unitario del CFDI viene redondeado a 2 decimales y el error se multiplica
  -- por la cantidad). Mínimo 1 centavo. Un error real de captura sigue fallando.
  v_tolerancia := GREATEST(0.01, 0.005 * COALESCE(v_suma_cantidades,0));

  v_diferencia := ABS(COALESCE(v_row.subtotal,0) - v_suma_conceptos);
  IF v_diferencia > v_tolerancia THEN
    RAISE EXCEPTION 'LC_CXP_DESCUADRE: Los conceptos (%) no cuadran con el subtotal (%) de la factura. Diferencia: % (tolerancia: %)',
      to_char(v_suma_conceptos,          'FM999,999,999,990.00'),
      to_char(COALESCE(v_row.subtotal,0),'FM999,999,999,990.00'),
      to_char(v_diferencia,              'FM999,999,999,990.00'),
      to_char(v_tolerancia,              'FM999,999,999,990.00');
  END IF;

  -- QA B-15: lo facturado en conceptos vinculados no debe exceder lo
  -- comprometido en conceptos_costo (tolerancia 0.02; umbral duro 5%).
  SELECT COALESCE(SUM(pfc.monto * COALESCE(NULLIF(pfc.cantidad,0),1)), 0),
         COALESCE(SUM(cc.monto), 0)
    INTO v_suma_vinculada, v_comprometido
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND pfc.concepto_costo_id IS NOT NULL;

  v_sobrecosto := v_suma_vinculada - v_comprometido;
  IF v_sobrecosto > 0.02 THEN
    IF v_comprometido > 0 AND v_sobrecosto > v_comprometido * 0.05 THEN
      RAISE EXCEPTION 'LC_CXP_SOBRECOSTO: Lo facturado (%) excede lo comprometido (%) en %; revisa los conceptos vinculados antes de aprobar.',
        to_char(v_suma_vinculada, 'FM999,999,999,990.00'),
        to_char(v_comprometido,   'FM999,999,999,990.00'),
        to_char(v_sobrecosto,     'FM999,999,999,990.00');
    ELSE
      RAISE WARNING 'LC_CXP_SOBRECOSTO: lo facturado (%) excede lo comprometido (%) en % (<= 5%%, se aprueba con advertencia).',
        to_char(v_suma_vinculada, 'FM999,999,999,990.00'),
        to_char(v_comprometido,   'FM999,999,999,990.00'),
        to_char(v_sobrecosto,     'FM999,999,999,990.00');
    END IF;
  END IF;

  -- Ola 4 (H2): three-way match mínimo. Sin embarque ni un solo concepto ligado
  -- a costo acordado no hay nada contra qué contrastar: se exige justificación
  -- escrita y, por arriba del umbral de la organización, se rechaza.
  IF v_row.embarque_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.proveedor_facturas_conceptos
        WHERE proveedor_factura_id = p_factura_id
          AND concepto_costo_id IS NOT NULL
     )
  THEN
    v_total_mxn := COALESCE(v_row.total,0) * CASE
      WHEN v_row.moneda = 'MXN'::public.moneda THEN 1
      ELSE COALESCE(NULLIF(v_row.tipo_cambio_usd,0), 1)
    END;
    v_umbral := public.cxp_umbral_sin_vinculo(v_row.organization_id);

    IF v_total_mxn > v_umbral THEN
      RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO_MONTO: La factura por % MXN no está ligada a un embarque ni a costos acordados y excede el umbral autorizado (%). Vincúlala al embarque o a sus conceptos de costo antes de aprobar.',
        to_char(v_total_mxn, 'FM999,999,999,990.00'),
        to_char(v_umbral,    'FM999,999,999,990.00');
    END IF;

    IF length(COALESCE(btrim(p_justificacion), '')) < 10 THEN
      RAISE EXCEPTION 'LC_CXP_SIN_RESPALDO: Esta factura no está ligada a un embarque ni a costos acordados. Escribe la justificación del gasto (mínimo 10 caracteres) para aprobarla.';
    END IF;
  END IF;

  IF v_row.embarque_id IS NOT NULL THEN
    SELECT estado, organization_id INTO v_emb_estado, v_emb_org
      FROM public.embarques WHERE id = v_row.embarque_id;
    IF v_emb_estado IS NULL THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: El embarque asociado no existe.';
    END IF;
    IF v_emb_estado = 'Cancelado' THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_CANCELADO: El embarque asociado está cancelado.';
    END IF;
    IF v_emb_org IS DISTINCT FROM v_row.organization_id THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: El embarque pertenece a otra organización.';
    END IF;
  END IF;

  SELECT origen_proveedor::text INTO v_origen
    FROM public.proveedores WHERE id = v_row.proveedor_id;

  IF COALESCE(v_origen,'Nacional') = 'Nacional'
     AND v_row.uuid_fiscal IS NOT NULL
     AND COALESCE(v_row.uuid_verificado,false) = false THEN
    RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO: Verifica el UUID en el SAT antes de aprobar.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid, text) TO authenticated, service_role;

-- La RPC de aprobación pasa el motivo como justificación y lo persiste.
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

  -- Ola 4 (H2): al aprobar, `p_motivo` es la justificación del gasto sin respaldo.
  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id, p_motivo);
  END IF;

  -- RNF-07: marca de sesión requerida por trg_guard_aprobacion_proveedor_factura
  -- (transaction-local: se limpia sola si la transacción aborta).
  PERFORM set_config('app.aprobando_cxp', '1', true);

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada',
        aprobada_por = v_uid,
        aprobada_at = now(),
        motivo_rechazo = NULL,
        aprobacion_heredada = false,
        justificacion_sin_vinculo = NULLIF(btrim(COALESCE(p_motivo,'')), '')
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
      jsonb_build_object(
        'motivo', p_motivo,
        'total', v_row.total,
        'aprobada', p_aprobar,
        'justificacion_sin_vinculo', v_row.justificacion_sin_vinculo
      ) || v_desvinculo
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

-- ---------- H7: reseed demo idempotente ----------

-- El borrado físico de facturas está prohibido; se abre una excepción acotada
-- a la organización demo y sólo durante el reseed (marca transaction-local).
CREATE OR REPLACE FUNCTION public._prohibir_delete_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.seed_demo', true) = '1'
     AND OLD.organization_id = 'de100000-0000-0000-0000-000000000001'::uuid THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'LC_FACTURA_DELETE_PROHIBIDO: las facturas no se borran físicamente; usa la baja lógica (soft_delete_record) o cancela/sustituye el CFDI'
    USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION public._seed_demo_limpiar_financiero()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
BEGIN
  PERFORM set_config('app.seed_demo', '1', true);

  -- Los REPs vivos bloquean el borrado de pagos: en demo se limpian primero.
  UPDATE public.pagos_factura
     SET uuid_rep = NULL, estado_rep = NULL, rep_cancelado_en = now()
   WHERE organization_id = v_org
     AND uuid_rep IS NOT NULL;

  -- CxC y comisiones (dependen de facturas y embarques).
  DELETE FROM public.comisiones_recalculo_pendiente WHERE organization_id = v_org;
  DELETE FROM public.comisiones_excepciones WHERE organization_id = v_org;
  DELETE FROM public.comisiones_devengadas WHERE organization_id = v_org;
  DELETE FROM public.liquidaciones_comision WHERE organization_id = v_org;
  DELETE FROM public.cobranza_seguimiento WHERE organization_id = v_org;
  DELETE FROM public.factura_recordatorios WHERE organization_id = v_org;
  DELETE FROM public.factura_envios WHERE organization_id = v_org;
  DELETE FROM public.factura_notas_credito WHERE organization_id = v_org;
  DELETE FROM public.bbva_movimientos WHERE organization_id = v_org;
  DELETE FROM public.traspasos_bancarios WHERE organization_id = v_org;
  DELETE FROM public.pagos_factura WHERE organization_id = v_org;
  DELETE FROM public.pagos_factura_lote WHERE organization_id = v_org;
  DELETE FROM public.pagos_proveedor_lote WHERE organization_id = v_org;
  DELETE FROM public.refacturaciones WHERE organization_id = v_org;
  DELETE FROM public.factura_embarques WHERE organization_id = v_org;
  DELETE FROM public.conceptos_factura WHERE organization_id = v_org;
  DELETE FROM public.facturas WHERE organization_id = v_org;

  -- Proformas y conceptos de venta/costo.
  DELETE FROM public.proforma_envios WHERE organization_id = v_org;
  DELETE FROM public.proforma_conceptos_consolidados WHERE organization_id = v_org;
  DELETE FROM public.conceptos_venta WHERE organization_id = v_org;
  DELETE FROM public.conceptos_costo WHERE organization_id = v_org;
  DELETE FROM public.proformas WHERE organization_id = v_org;

  -- Operación del embarque.
  DELETE FROM public.embarque_facturas_entrantes_conceptos WHERE organization_id = v_org;
  DELETE FROM public.embarque_facturas_entrantes WHERE organization_id = v_org;
  DELETE FROM public.embarque_garantias_historial WHERE organization_id = v_org;
  DELETE FROM public.embarque_garantias_contenedor WHERE organization_id = v_org;
  DELETE FROM public.embarque_contenedores WHERE organization_id = v_org;
  DELETE FROM public.documentos_embarque WHERE organization_id = v_org;
  DELETE FROM public.notas_embarque WHERE organization_id = v_org;
  DELETE FROM public.seguros_embarque WHERE organization_id = v_org;
  DELETE FROM public.cierre_embarque_log WHERE organization_id = v_org;
  DELETE FROM public.tracking_externo WHERE organization_id = v_org;
  DELETE FROM public.tracking_links WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_costos WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_versiones WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_envios WHERE organization_id = v_org;

  PERFORM set_config('app.seed_demo', '0', true);
END;
$function$;

REVOKE ALL ON FUNCTION public._seed_demo_limpiar_financiero() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._seed_demo_limpiar_financiero() TO service_role;

CREATE OR REPLACE FUNCTION public.seed_demo_organization()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- M8: sólo service_role (edge `demo-access`) o super_admin explícito.
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  -- Candado de transacción: un solo re-sembrado a la vez.
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  -- Ola 4 (H7): antes el reseed fallaba por FK si alguien había operado en la
  -- demo (facturas/pagos generados después del último sembrado).
  PERFORM public._seed_demo_limpiar_financiero();

  PERFORM public.seed_demo_organization_core();
END;
$function$;
