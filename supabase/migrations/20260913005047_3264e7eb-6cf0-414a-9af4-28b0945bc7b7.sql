-- ============================================================================
-- MR/A/B — candados de cierre, concurrencia en aprobación y tenant activo
-- ============================================================================

-- ── B-1: el tenant activo manda para el super_admin ─────────────────────────
-- Un solo punto: todas las RPC SECURITY DEFINER que resuelven la organización
-- con current_user_org_id() quedan alineadas al tenant activo del selector.
-- No hay recursión: org_scope() resuelve su propia rama de super_admin.
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin'::app_role)
      THEN COALESCE(
             (SELECT s.organization_id FROM public.super_admin_org_activa s
               WHERE s.user_id = auth.uid()),
             public.default_user_org_id())
    ELSE public.default_user_org_id()
  END;
$function$;

-- ── A-2: bloqueo financiero en embarques cerrados ───────────────────────────
-- Bloquea INSERT/DELETE y los UPDATE que toquen columnas financieras o de
-- vínculo. Los cambios de estado/traza (estado, estado_rep, cancelaciones,
-- aprobaciones, updated_at) siguen permitidos para no romper la conciliación
-- automática con el SAT ni los recálculos de estado de factura.
CREATE OR REPLACE FUNCTION public.tg_bloquear_financiero_embarque_cerrado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row jsonb;
  v_emb uuid;
  v_pf uuid;
  v_estado text;
  v_prot text[] := ARRAY[
    'embarque_id','factura_id','proveedor_factura_id','concepto_costo_id',
    'cliente_id','proveedor_id','monto','monto_mxn','monto_aplicado_factura',
    'monto_declarado','total','total_detectado','subtotal','subtotal_detectado',
    'iva','ieps','retenciones','moneda','moneda_detectada','moneda_declarada',
    'tipo_cambio','tipo_cambio_usd','comision_mxn','pnl_base','deleted_at'
  ];
  v_col text;
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_row := to_jsonb(COALESCE(NEW, OLD));
  v_emb := NULLIF(v_row->>'embarque_id','')::uuid;
  IF v_emb IS NULL THEN
    v_pf := NULLIF(v_row->>'proveedor_factura_id','')::uuid;
    IF v_pf IS NOT NULL THEN
      SELECT pf.embarque_id INTO v_emb FROM public.proveedor_facturas pf WHERE pf.id = v_pf;
    END IF;
  END IF;
  IF v_emb IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_estado := public._assert_embarque_abierto_locked(v_emb);
  IF v_estado IS DISTINCT FROM 'Cerrado' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    FOREACH v_col IN ARRAY v_prot LOOP
      IF (to_jsonb(NEW) ? v_col)
         AND (to_jsonb(NEW)->v_col) IS DISTINCT FROM (to_jsonb(OLD)->v_col) THEN
        RAISE EXCEPTION 'LC_EMBARQUE_CERRADO: el embarque está cerrado; reábrelo para modificar % en %.', v_col, TG_TABLE_NAME
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_EMBARQUE_CERRADO: el embarque está cerrado; reábrelo antes de registrar o eliminar en %.', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

REVOKE ALL ON FUNCTION public.tg_bloquear_financiero_embarque_cerrado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_bloquear_financiero_embarque_cerrado() TO service_role;

DROP TRIGGER IF EXISTS trg_cierre_financiero ON public.pagos_factura;
CREATE TRIGGER trg_cierre_financiero
  BEFORE INSERT OR UPDATE OR DELETE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_financiero_embarque_cerrado();

DROP TRIGGER IF EXISTS trg_cierre_financiero ON public.pagos_proveedor;
CREATE TRIGGER trg_cierre_financiero
  BEFORE INSERT OR UPDATE OR DELETE ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_financiero_embarque_cerrado();

DROP TRIGGER IF EXISTS trg_cierre_financiero ON public.facturas;
CREATE TRIGGER trg_cierre_financiero
  BEFORE INSERT OR UPDATE OR DELETE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_financiero_embarque_cerrado();

DROP TRIGGER IF EXISTS trg_cierre_financiero ON public.proveedor_facturas;
CREATE TRIGGER trg_cierre_financiero
  BEFORE INSERT OR UPDATE OR DELETE ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_financiero_embarque_cerrado();

DROP TRIGGER IF EXISTS trg_cierre_financiero ON public.comisiones_devengadas;
CREATE TRIGGER trg_cierre_financiero
  BEFORE INSERT OR UPDATE OR DELETE ON public.comisiones_devengadas
  FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_financiero_embarque_cerrado();

DROP TRIGGER IF EXISTS trg_cierre_financiero ON public.embarque_facturas_entrantes;
CREATE TRIGGER trg_cierre_financiero
  BEFORE INSERT OR UPDATE OR DELETE ON public.embarque_facturas_entrantes
  FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_financiero_embarque_cerrado();

-- ── A-1: garantías de contenedor respetan el cierre ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_garantia_estado(
  p_id uuid,
  p_estado text DEFAULT NULL::text,
  p_fecha_deposito date DEFAULT NULL::date,
  p_fecha_liberacion date DEFAULT NULL::date,
  p_monto numeric DEFAULT NULL::numeric,
  p_referencia text DEFAULT NULL::text,
  p_notas text DEFAULT NULL::text)
RETURNS embarque_garantias_contenedor
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.embarque_garantias_contenedor;
  v_org uuid;
  v_estado_emb text;
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_org'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_GARANTIA_SIN_ROL'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM public.embarque_garantias_contenedor WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_GARANTIA_NO_ENCONTRADA' USING ERRCODE = 'no_data_found';
  END IF;

  v_org := current_user_org_id();
  IF v_row.organization_id <> v_org AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_GARANTIA_ORG_MISMATCH' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A-1: un embarque Cerrado ya tiene snapshot y P&L congelados.
  IF current_setting('app.bypass_cierre', true) <> 'on' THEN
    v_estado_emb := public._assert_embarque_abierto_locked(v_row.embarque_id);
    IF v_estado_emb = 'Cerrado' THEN
      RAISE EXCEPTION 'LC_EMBARQUE_CERRADO: el embarque está cerrado; reábrelo antes de modificar la garantía.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.embarque_garantias_contenedor
     SET estado             = COALESCE(p_estado, estado),
         fecha_deposito     = COALESCE(p_fecha_deposito, fecha_deposito),
         fecha_liberacion   = COALESCE(p_fecha_liberacion, fecha_liberacion),
         monto_deposito_usd = COALESCE(p_monto, monto_deposito_usd),
         referencia_deposito= COALESCE(p_referencia, referencia_deposito),
         notas              = COALESCE(p_notas, notas),
         updated_at         = now()
   WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- ── A-3: aprobación/rechazo serializado ─────────────────────────────────────
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
  v_estado_actual text;
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

  -- A-3: FOR UPDATE serializa dos clics simultáneos sobre la misma factura.
  SELECT * INTO v_row FROM public.proveedor_facturas
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
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

  -- A-3: relectura redundante dentro del bloqueo (defensa ante validaciones
  -- que pudieran liberar el lock por subtransacciones).
  SELECT estado_aprobacion::text INTO v_estado_actual
    FROM public.proveedor_facturas WHERE id = p_id FOR UPDATE;
  IF v_estado_actual <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_estado_actual;
  END IF;

  -- RNF-07: marca de sesión requerida por trg_guard_aprobacion_proveedor_factura
  PERFORM set_config('app.aprobando_cxp', '1', true);

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada',
        aprobada_por = v_uid,
        aprobada_at = now(),
        motivo_rechazo = NULL,
        aprobacion_heredada = false,
        justificacion_sin_vinculo = NULLIF(btrim(COALESCE(p_motivo,'')), '')
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id AND estado_aprobacion = 'pendiente' RETURNING * INTO v_row;
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'La factura ya fue procesada por otra sesión. Recarga la pantalla.'
      USING ERRCODE = 'serialization_failure';
  END IF;

  IF NOT p_aprobar THEN
    -- v13.493.0 — el rechazo rompe el vínculo con el embarque.
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
