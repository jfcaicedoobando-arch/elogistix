-- Sólo CI efímero. Reejecuta el payload real de la migración dentro de rollback.
-- El payload se mantiene byte por byte sin el BEGIN/COMMIT exterior.
BEGIN;
DO $test$
DECLARE
  v_oid oid := 'public.aprobar_factura_proveedor(uuid,boolean,text,timestamp with time zone)'::regprocedure;
  v_before jsonb;
  v_after jsonb;
  v_drift jsonb;
  v_source text;
  v_definition text;
  v_state text;
  v_message text;
  v_iteration integer;
  v_payload text := $ci_payload$CREATE TEMP TABLE cxp_autoaprobacion_20261013195000_before (
  function_oid oid PRIMARY KEY,
  metadata jsonb NOT NULL
) ON COMMIT DROP;
DO $preflight$
DECLARE
  v_oid oid := to_regprocedure('public.aprobar_factura_proveedor(uuid,boolean,text,timestamp with time zone)');
  v_metadata jsonb;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'CXP_AUTOAPROBACION_PREFLIGHT: falta la firma esperada';
  END IF;
  SELECT to_jsonb(p) INTO STRICT v_metadata FROM pg_proc p WHERE p.oid = v_oid;
  IF md5(v_metadata->>'prosrc') NOT IN ('5f9b32fd2582f79503f00fb309df8bd2', 'c910bfde57c93d5e8a225d221cbe41b1') THEN
    RAISE EXCEPTION 'CXP_AUTOAPROBACION_PREFLIGHT: definición distinta de la revisada';
  END IF;
  INSERT INTO pg_temp.cxp_autoaprobacion_20261013195000_before VALUES (v_oid, v_metadata);
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL::text, p_expected_updated_at timestamptz DEFAULT NULL::timestamptz) RETURNS public.proveedor_facturas
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_puede_autoaprobar_cxp boolean;
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
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador'])
  ) INTO v_puede_autoaprobar_cxp;
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
  IF p_expected_updated_at IS NULL OR v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: la factura cambió desde que la revisaste. Recarga y revisa los datos actuales antes de decidir.'
      USING ERRCODE = 'PT409';
  END IF;
  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;
  -- SoD CxP: administradores y contador pueden aprobar su propia factura.
  IF p_aprobar
     AND v_row.created_by IS NOT NULL
     AND v_row.created_by = v_uid
     AND NOT v_puede_autoaprobar_cxp
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
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, fuente_evento)
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
        'moneda', v_row.moneda,
        'tipo_cambio_usd', v_row.tipo_cambio_usd,
        'aprobada', p_aprobar,
        'justificacion_sin_vinculo', v_row.justificacion_sin_vinculo
      ) || v_desvinculo,
      'rpc_aprobar_factura_proveedor'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;
  RETURN v_row;
END;
$$;

DO $postcheck$
DECLARE v_before record; v_after jsonb;
BEGIN
  SELECT * INTO STRICT v_before FROM pg_temp.cxp_autoaprobacion_20261013195000_before;
  SELECT to_jsonb(p) INTO v_after FROM pg_proc p WHERE p.oid = v_before.function_oid;
  IF v_after IS NULL OR (v_after - 'prosrc') IS DISTINCT FROM (v_before.metadata - 'prosrc')
     OR md5(v_after->>'prosrc') IS DISTINCT FROM 'c910bfde57c93d5e8a225d221cbe41b1' THEN
    RAISE EXCEPTION 'CXP_AUTOAPROBACION_POSTCHECK: cambió la identidad, ACL, owner o atributos';
  END IF;
END;
$postcheck$;
$ci_payload$;
BEGIN
  SELECT to_jsonb(p) INTO STRICT v_before FROM pg_proc p WHERE p.oid = v_oid;
  IF md5(v_before->>'prosrc') IS DISTINCT FROM 'c910bfde57c93d5e8a225d221cbe41b1' THEN
    RAISE EXCEPTION 'CXP MIGRATION TEST: falta postimagen inicial';
  END IF;
  FOR v_iteration IN 1..2 LOOP
    EXECUTE v_payload;
    SELECT to_jsonb(p) INTO STRICT v_after FROM pg_proc p WHERE p.oid = v_oid;
    IF v_after IS DISTINCT FROM v_before THEN
      RAISE EXCEPTION 'CXP MIGRATION TEST: replay % cambió catálogo', v_iteration;
    END IF;
    DROP TABLE pg_temp.cxp_autoaprobacion_20261013195000_before;
  END LOOP;
  -- Drift sintético sin cambio de conducta: se revierte con el ROLLBACK final.
  v_source := v_before->>'prosrc';
  v_definition := pg_get_functiondef(v_oid);
  EXECUTE replace(v_definition, v_source, v_source || E'\n-- synthetic CI drift\n');
  SELECT to_jsonb(p) INTO STRICT v_drift FROM pg_proc p WHERE p.oid = v_oid;
  IF md5(v_drift->>'prosrc') IN ('5f9b32fd2582f79503f00fb309df8bd2', 'c910bfde57c93d5e8a225d221cbe41b1') THEN
    RAISE EXCEPTION 'CXP MIGRATION TEST: fixture de drift no cambió cuerpo';
  END IF;
  BEGIN
    EXECUTE v_payload;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS DISTINCT FROM 'P0001' OR v_message IS DISTINCT FROM
    'CXP_AUTOAPROBACION_PREFLIGHT: definición distinta de la revisada' THEN
    RAISE EXCEPTION 'CXP MIGRATION TEST: esperaba preflight de drift, obtuvo %/%', v_state, v_message;
  END IF;
  SELECT to_jsonb(p) INTO STRICT v_after FROM pg_proc p WHERE p.oid = v_oid;
  IF v_after IS DISTINCT FROM v_drift THEN
    RAISE EXCEPTION 'CXP MIGRATION TEST: rechazo de drift sobrescribió catálogo';
  END IF;
  IF to_regclass('pg_temp.cxp_autoaprobacion_20261013195000_before') IS NOT NULL THEN
    RAISE EXCEPTION 'CXP MIGRATION TEST: rechazo dejó snapshot temporal';
  END IF;
  RAISE NOTICE 'PASS CxP migration: replay doble idéntico, drift rechazado sin sobrescritura';
END;
$test$;
ROLLBACK;
