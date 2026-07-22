
-- =====================================================================
-- FIX-R4-04: Serializar pagos por factura (evita TOCTOU sobrepago CxC)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_pago_factura_no_sobrepago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo numeric;
  v_delta numeric;
  v_factura_org uuid;
  v_caller_org uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
    v_delta := COALESCE(NEW.monto_aplicado_factura,0) - COALESCE(OLD.monto_aplicado_factura,0);
  ELSE
    v_delta := COALESCE(NEW.monto_aplicado_factura,0);
  END IF;

  IF v_delta <= 0 THEN RETURN NEW; END IF;

  -- FIX-R4-04: lock de la factura para serializar pagos concurrentes.
  PERFORM 1 FROM public.facturas
    WHERE id = NEW.factura_id AND deleted_at IS NULL FOR UPDATE;

  SELECT organization_id INTO v_factura_org
  FROM public.facturas
  WHERE id = NEW.factura_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.organization_id IS DISTINCT FROM v_factura_org THEN
    RAISE EXCEPTION 'LC_TENANT_MISMATCH: el pago debe pertenecer a la misma organización que la factura'
      USING ERRCODE='23514';
  END IF;

  v_caller_org := public.current_user_org_id();

  IF v_caller_org IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_factura_org IS DISTINCT FROM v_caller_org THEN
    RETURN NEW;
  END IF;

  SELECT public.saldo_factura(NEW.factura_id) INTO v_saldo;
  IF TG_OP = 'UPDATE' THEN
    v_saldo := v_saldo + COALESCE(OLD.monto_aplicado_factura,0);
  END IF;

  IF v_delta > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura',
      round(v_delta,2), round(v_saldo,2)
      USING ERRCODE='P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- FIX-R4-05: fallback de monto para prorrateo de retenciones
-- =====================================================================
CREATE OR REPLACE FUNCTION public.calc_pago_retenciones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fac_subtotal numeric; v_fac_iva numeric;
  v_fac_ret_isr numeric; v_fac_ret_iva numeric;
  v_base numeric; v_ratio numeric; v_monto numeric;
BEGIN
  IF COALESCE(NEW.ret_isr,0) > 0 OR COALESCE(NEW.ret_iva,0) > 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(subtotal,0), COALESCE(iva,0), COALESCE(ret_isr,0), COALESCE(ret_iva,0)
    INTO v_fac_subtotal, v_fac_iva, v_fac_ret_isr, v_fac_ret_iva
    FROM public.facturas WHERE id = NEW.factura_id;
  v_base := v_fac_subtotal + v_fac_iva - v_fac_ret_iva - v_fac_ret_isr;
  -- FIX-R4-05: si monto_aplicado_factura aún no llegó (otro trigger BEFORE lo poblará),
  -- usar NEW.monto como base para prorratear las retenciones.
  v_monto := COALESCE(NULLIF(NEW.monto_aplicado_factura,0), NEW.monto);
  IF v_base > 0 AND COALESCE(v_monto,0) > 0 THEN
    v_ratio := v_monto / v_base;
    NEW.ret_isr := ROUND(v_fac_ret_isr * v_ratio, 2);
    NEW.ret_iva := ROUND(v_fac_ret_iva * v_ratio, 2);
  END IF;
  RETURN NEW;
END;
$function$;

-- =====================================================================
-- FIX-R4-06: exigir TC del pago en cruces MXN<->USD
-- =====================================================================
CREATE OR REPLACE FUNCTION public.convertir_monto_pago_a_factura(
  p_monto numeric, p_moneda_pago moneda, p_tc_pago numeric,
  p_moneda_fact moneda, p_tc_fact numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE v_tc numeric;
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_fact THEN RETURN p_monto; END IF;

  IF (p_moneda_pago = 'MXN' AND p_moneda_fact = 'USD')
     OR (p_moneda_pago = 'USD' AND p_moneda_fact = 'MXN') THEN
    -- FIX-R4-06: TC de la factura es referencia contable, NO sustituto del TC real
    -- del pago. Se exige capturarlo explícitamente en cada pago cruzado.
    v_tc := NULLIF(p_tc_pago, 0);
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: capture el tipo de cambio del pago (%->%)',
        p_moneda_pago, p_moneda_fact
        USING ERRCODE = '22023';
    END IF;
    IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / v_tc, 4);
    ELSE                          RETURN round(p_monto * v_tc, 4);
    END IF;
  END IF;

  RAISE EXCEPTION 'LC_PAGO_CRUCE_NO_SOPORTADO: conversion % -> % no soportada.',
    p_moneda_pago, p_moneda_fact
    USING ERRCODE = '22023';
END;
$function$;

-- =====================================================================
-- FIX-R4-08: eliminar sobrecarga ambigua generar_expediente(text)
-- =====================================================================
DROP FUNCTION IF EXISTS public.generar_expediente(text);

-- =====================================================================
-- FIX-R4-10a: fail-closed en saldo_factura
-- =====================================================================
CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT total, estado, organization_id INTO v_total, v_estado, v_org
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  -- FIX-R4-10a: fail-closed cuando hay usuario autenticado.
  -- Bypass sólo para service_role, triggers internos (uid IS NULL) o super_admin.
  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_id AND deleted_at IS NULL AND estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;

-- =====================================================================
-- FIX-R4-10a (bis): fail-closed en validar_cierre_embarque
-- =====================================================================
CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_ok boolean;
  v_cxc_saldo numeric; v_cxc_total numeric; v_cxc_pagado numeric; v_cxc_ncs numeric;
  v_cxp_total numeric; v_cxp_pagado numeric;
  v_docs_faltantes int;
  v_utilidad_mxn numeric; v_venta_mxn numeric; v_margen_min numeric; v_margen_pct numeric;
  v_pnl jsonb; v_pnl_error text;
  v_com_count int;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
  v_caller_org uuid; v_uid uuid;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  -- FIX-R4-10a: fail-closed para usuarios autenticados sin membresía o de otra org.
  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_emb.organization_id <> v_caller_org THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: sin acceso al embarque' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_emb.modo = 'Marítimo' AND COALESCE(v_emb.tipo_carga,'') ILIKE 'FCL%' THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_cont_incompletos, v_cont_ids
    FROM embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
      AND (peso_kg IS NULL OR peso_kg <= 0 OR volumen_m3 IS NULL OR volumen_m3 <= 0);
    v_ok := (v_cont_incompletos = 0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_datos_completos','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_incompletos', v_cont_incompletos, 'ids', v_cont_ids)));
  END IF;

  SELECT EXISTS (SELECT 1 FROM embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL) INTO v_tiene_contenedores;
  IF v_tiene_contenedores THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_cont_sin_fechas, v_cont_fechas_ids
    FROM embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
      AND (fecha_descarga IS NULL OR fecha_devolucion IS NULL);
    v_ok := (v_cont_sin_fechas = 0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_fechas_completas','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_sin_fechas', v_cont_sin_fechas, 'ids', v_cont_fechas_ids)));
  END IF;

  SELECT COUNT(*) INTO v_docs_faltantes FROM documentos_embarque de
   WHERE de.embarque_id = p_embarque_id AND de.deleted_at IS NULL
     AND (de.archivo IS NULL OR de.archivo = '') AND de.estado <> 'No aplica';
  v_ok := (v_docs_faltantes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));

  SELECT COUNT(*) INTO v_costos_sin_factura FROM conceptos_costo cc
   WHERE cc.embarque_id = p_embarque_id AND cc.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM proveedor_facturas_conceptos pfc
       JOIN proveedor_facturas pf2 ON pf2.id = pfc.proveedor_factura_id
       WHERE pfc.concepto_costo_id = cc.id AND pf2.deleted_at IS NULL AND pf2.estado <> 'Cancelada');
  v_ok := (v_costos_sin_factura = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','costo_conceptos_con_factura','ok',v_ok,
    'detalle', jsonb_build_object('sin_factura', v_costos_sin_factura)));

  SELECT COALESCE(sum(total),0) INTO v_cxp_total FROM proveedor_facturas
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pp.monto),0) INTO v_cxp_pagado
    FROM pagos_proveedor pp
    JOIN proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
   WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
     AND pp.deleted_at IS NULL;
  v_ok := (v_cxp_total <= v_cxp_pagado + 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxp_total, 'pagado', v_cxp_pagado)));

  SELECT COUNT(*) FILTER (WHERE estado_facturacion = 'pendiente'),
         COUNT(*) FILTER (WHERE estado_facturacion = 'en_proforma')
    INTO v_venta_pendientes, v_venta_en_proforma
    FROM conceptos_venta WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  v_ok := (v_venta_pendientes = 0 AND v_venta_en_proforma = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','venta_conceptos_facturados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_venta_pendientes, 'en_proforma', v_venta_en_proforma)));

  SELECT COALESCE(SUM(public.saldo_factura(f.id)), 0), COALESCE(SUM(f.total), 0)
    INTO v_cxc_saldo, v_cxc_total FROM facturas f
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador');
  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_cxc_pagado
    FROM pagos_factura pf JOIN facturas f ON f.id = pf.factura_id
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador') AND pf.deleted_at IS NULL;
  SELECT COALESCE(SUM(nc.monto), 0) INTO v_cxc_ncs
    FROM factura_notas_credito nc JOIN facturas f ON f.id = nc.factura_id
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
     AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada';
  v_ok := (v_cxc_saldo <= 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxc_total, 'pagado', v_cxc_pagado,
      'notas_credito', v_cxc_ncs, 'saldo', v_cxc_saldo)));

  SELECT COUNT(*), COALESCE(array_agg(pf.id), ARRAY[]::uuid[])
    INTO v_rep_pendientes, v_rep_ids
    FROM pagos_factura pf JOIN facturas f ON f.id = pf.factura_id
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
     AND pf.deleted_at IS NULL AND f.metodo_pago = 'PPD'
     AND COALESCE(pf.estado_rep, 'Pendiente') NOT IN ('Timbrado', 'No aplica');
  v_ok := (v_rep_pendientes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','rep_timbrados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_rep_pendientes, 'ids', v_rep_ids)));

  SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas
   WHERE embarque_id = p_embarque_id AND definitiva = false;
  v_ok := (v_com_count = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comisiones_definitivas','ok',v_ok,
    'detalle', jsonb_build_object('no_definitivas', v_com_count)));

  v_pnl_error := NULL; v_utilidad_mxn := 0; v_venta_mxn := 0;
  BEGIN
    v_pnl := public.pnl_financiero_embarque(p_embarque_id);
    v_utilidad_mxn := COALESCE((v_pnl->>'utilidad_mxn')::numeric, 0);
    v_venta_mxn := COALESCE((v_pnl->>'venta_mxn')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_pnl_error := SQLERRM;
  END;

  IF v_pnl_error IS NOT NULL THEN
    v_puede := v_puede AND false;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','pnl_error','ok',false,
      'detalle', jsonb_build_object('error', v_pnl_error)));
  END IF;

  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global
     WHERE categoria='fiscal' AND clave='pnl_margen_minimo_cierre' LIMIT 1), 0)
    INTO v_margen_min;

  v_margen_pct := CASE WHEN v_venta_mxn > 0
                       THEN ROUND(v_utilidad_mxn / v_venta_mxn * 100.0, 2)
                       ELSE 0 END;
  v_ok := (v_venta_mxn <= 0) OR (v_margen_pct >= v_margen_min);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object(
      'utilidad_mxn', v_utilidad_mxn,
      'venta_mxn', v_venta_mxn,
      'margen_pct', v_margen_pct,
      'minimo_pct', v_margen_min)));

  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END $function$;

-- =====================================================================
-- FIX-R4-10b: filtrar marcar_facturas_vencidas por organización
-- =====================================================================
CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_count integer; v_uid uuid; v_org uuid; v_is_service boolean;
BEGIN
  PERFORM set_config('app.recalc_estado_factura','1', true);
  v_uid := auth.uid();
  v_org := public.current_user_org_id();
  v_is_service := (auth.role() = 'service_role');

  UPDATE public.facturas
     SET estado = 'Vencida'::estado_factura, updated_at = now()
   WHERE estado::text IN ('Emitida','Parcialmente pagada')
     AND fecha_vencimiento IS NOT NULL
     AND fecha_vencimiento < CURRENT_DATE
     AND deleted_at IS NULL
     AND (
       v_is_service                                                 -- cron/backend: global
       OR public.has_role(v_uid, 'super_admin'::app_role)           -- super_admin: global
       OR (v_org IS NOT NULL AND organization_id = v_org)           -- usuario: sólo su org
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.recalc_estado_factura','0', true);
  RETURN v_count;
END $function$;

-- =====================================================================
-- FIX-R4-10c: revocar permisos públicos de función interna
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public._recalc_estado_proveedor_factura(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._recalc_estado_proveedor_factura(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public._recalc_estado_proveedor_factura(uuid) FROM authenticated;

-- =====================================================================
-- FIX-R4-11: guard de REP vivo incluye estado 'Pendiente'
-- =====================================================================
CREATE OR REPLACE FUNCTION public.assert_pago_sin_rep_vivo_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.uuid_rep IS NOT NULL
     AND COALESCE(OLD.estado_rep, 'Pendiente') IN ('Pendiente','Timbrado') THEN
    RAISE EXCEPTION 'LC_PAGO_CON_REP_VIVO: el pago tiene un REP vivo (%), cancele o descarte el REP antes de eliminar',
      COALESCE(OLD.estado_rep, 'Pendiente')
      USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END $function$;

-- =====================================================================
-- FIX-R4-12: calcular_comision_pago ignora tipo_cambio=1 para USD/EUR
-- =====================================================================
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname='calcular_comision_pago' AND pronamespace='public'::regnamespace
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE NOTICE 'calcular_comision_pago no existe; se omite fix R4-12.';
  END IF;
END $do$;

-- Re-crea la función preservando su firma trigger; usa TC del embarque si tipo_cambio=1
CREATE OR REPLACE FUNCTION public.calcular_comision_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_factura public.facturas%ROWTYPE;
  v_emb public.embarques%ROWTYPE;
  v_tc numeric;
  v_moneda text;
  v_mxn numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_factura FROM public.facturas WHERE id = NEW.factura_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_moneda := COALESCE(NEW.moneda::text, v_factura.moneda::text, 'MXN');
  v_tc := NULLIF(NEW.tipo_cambio, 0);

  -- FIX-R4-12: TC=1 en moneda extranjera es imposible; buscar TC real del embarque.
  IF v_moneda IN ('USD','EUR') AND (v_tc IS NULL OR v_tc = 1) THEN
    IF v_factura.embarque_id IS NOT NULL THEN
      SELECT * INTO v_emb FROM public.embarques WHERE id = v_factura.embarque_id;
      IF v_moneda = 'USD' THEN v_tc := NULLIF(v_emb.tipo_cambio_usd, 0); END IF;
      IF v_moneda = 'EUR' THEN v_tc := NULLIF(v_emb.tipo_cambio_eur, 0); END IF;
    END IF;
    IF v_tc IS NULL OR v_tc = 1 THEN
      v_tc := NULLIF(v_factura.tipo_cambio, 0);
    END IF;
  END IF;

  IF v_moneda = 'MXN' THEN
    v_mxn := COALESCE(NEW.monto, 0);
  ELSE
    v_mxn := COALESCE(NEW.monto, 0) * COALESCE(v_tc, 1);
  END IF;

  NEW.monto_cobrado_mxn := ROUND(v_mxn, 2);
  RETURN NEW;
END $function$;

-- =====================================================================
-- FIX-R4-13: signup no crea org basura ni rol global admin_org
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_company_name text;
  v_org_id uuid;
  v_user_count int;
  v_skip boolean := coalesce(NEW.raw_user_meta_data->>'skip_auto_org', 'false') = 'true';
BEGIN
  IF v_skip THEN
    RETURN NEW;
  END IF;

  -- Bootstrap: primer usuario del sistema recibe super_admin global.
  SELECT count(*) INTO v_user_count FROM public.user_roles;
  IF v_user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Sólo crear organización si el usuario proporcionó nombre de empresa.
  v_company_name := trim(coalesce(NEW.raw_user_meta_data->>'company_name', ''));
  IF length(v_company_name) = 0 THEN
    -- Sin company_name: NO se crea org ni membresía; el rol/membresía se fijan
    -- vía onboarding o invitación posterior.
    RETURN NEW;
  END IF;

  IF length(v_company_name) > 120 THEN
    v_company_name := substring(v_company_name FROM 1 FOR 120);
  END IF;

  INSERT INTO public.organizations (nombre, plan, activo)
  VALUES (v_company_name, 'basic', true) RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'admin_org'::public.app_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN NEW;
END $function$;
