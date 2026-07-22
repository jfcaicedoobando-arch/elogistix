ALTER TABLE public.embarque_contenedores DROP CONSTRAINT IF EXISTS contenedor_iso6346;
ALTER TABLE public.embarque_contenedores ADD CONSTRAINT contenedor_iso6346
  CHECK (numero_contenedor IS NULL OR numero_contenedor = ''
         OR numero_contenedor ~ '^[A-Z]{4}[0-9]{7}$') NOT VALID;

ALTER TABLE public.pagos_proveedor ALTER COLUMN tipo_cambio_usd DROP DEFAULT;
ALTER TABLE public.pagos_proveedor DROP CONSTRAINT IF EXISTS pagos_proveedor_tc_pos;
ALTER TABLE public.pagos_proveedor ADD CONSTRAINT pagos_proveedor_tc_pos
  CHECK (tipo_cambio_usd IS NULL OR tipo_cambio_usd > 0) NOT VALID;

CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_count integer;
BEGIN
  PERFORM set_config('app.recalc_estado_factura','1', true);
  UPDATE public.facturas
     SET estado = 'Vencida'::estado_factura, updated_at = now()
   WHERE estado::text IN ('Emitida','Parcialmente pagada')
     AND fecha_vencimiento IS NOT NULL
     AND fecha_vencimiento < CURRENT_DATE
     AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.recalc_estado_factura','0', true);
  RETURN v_count;
END $fn$;

CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_ok boolean;
  v_cxc_saldo numeric; v_cxc_total numeric; v_cxc_pagado numeric; v_cxc_ncs numeric;
  v_cxp_total numeric; v_cxp_pagado numeric;
  v_docs_faltantes int;
  v_utilidad_mxn numeric; v_margen_min numeric;
  v_com_count int;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
  v_caller_org uuid;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;

  v_caller_org := public.current_user_org_id();
  IF v_caller_org IS NOT NULL
     AND v_emb.organization_id <> v_caller_org
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: sin acceso al embarque' USING ERRCODE='P0001';
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

  BEGIN
    SELECT COALESCE((public.pnl_financiero_embarque(p_embarque_id)->>'utilidad_mxn')::numeric, 0)
      INTO v_utilidad_mxn;
  EXCEPTION WHEN OTHERS THEN v_utilidad_mxn := 0; END;

  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global
     WHERE categoria='fiscal' AND clave='pnl_margen_minimo_cierre' LIMIT 1), 0)
    INTO v_margen_min;

  v_ok := (v_utilidad_mxn >= v_margen_min); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad_mxn', v_utilidad_mxn, 'minimo', v_margen_min)));

  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END $fn$;

REVOKE EXECUTE ON FUNCTION public._recalc_estado_proveedor_factura(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE VIEW public.costeo_tarifas_vigentes_v AS
 SELECT t.id, t.organization_id, t.agente_id, a.nombre AS agente_nombre, a.dias_credito,
    t.naviera_id, n.name AS naviera_nombre, t.ruta_id, r.puerto_origen_id, r.puerto_destino_id,
    po.name AS puerto_origen_nombre, pd.name AS puerto_destino_nombre,
    t.tipo_contenedor_id, tc.name AS tipo_contenedor_nombre,
    t.moneda, t.flete_base,
    COALESCE((SELECT sum(rc.monto) FROM costeo_tarifa_recargos rc
              WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS recargos_total,
    t.flete_base + COALESCE((SELECT sum(rc.monto) FROM costeo_tarifa_recargos rc
              WHERE rc.tarifa_id = t.id AND rc.incluido_en_total), 0::numeric) AS total_comparable,
    t.dias_libres_demoras, t.transit_time_dias, t.vigente_desde, t.vigente_hasta, t.estado,
    nc.id AS naviera_condicion_id,
    COALESCE(nc.tiene_carta_garantia, false) AS naviera_tiene_carta_garantia,
    nc.carta_garantia_vigente_hasta AS naviera_carta_garantia_vigente_hasta,
    (nc.tiene_carta_garantia = true AND nc.carta_garantia_vigente_hasta IS NOT NULL
       AND nc.carta_garantia_vigente_hasta >= CURRENT_DATE) AS naviera_carta_garantia_activa,
    nc.dias_libres_demoras_default AS naviera_dias_libres_default,
    (SELECT dt.monto_por_dia FROM costeo_naviera_demoras_tarifa dt
      WHERE dt.naviera_condicion_id = nc.id AND dt.tipo_contenedor_id = t.tipo_contenedor_id
        AND dt.desde_dia <= 6 AND (dt.hasta_dia IS NULL OR dt.hasta_dia >= 6) LIMIT 1)
      AS naviera_demora_dia_6,
    t.dias_libres_almacenaje_lcl,
    COALESCE(t.frecuencia_override, nc.frecuencia) AS frecuencia_resuelta,
    nc.frecuencia AS naviera_frecuencia,
    t.frecuencia_override AS tarifa_frecuencia_override
   FROM costeo_tarifas t
   JOIN costeo_agentes a ON a.id = t.agente_id
   JOIN navieras n ON n.id = t.naviera_id
   JOIN costeo_rutas r ON r.id = t.ruta_id
   JOIN puertos po ON po.id = r.puerto_origen_id
   JOIN puertos pd ON pd.id = r.puerto_destino_id
   JOIN tipos_contenedor tc ON tc.id = t.tipo_contenedor_id
   LEFT JOIN costeo_navieras_condiciones nc
     ON nc.naviera_id = t.naviera_id AND nc.organization_id = t.organization_id
  WHERE t.estado_aprobacion = 'vigente'::text
    AND t.estado::text = 'vigente'
    AND t.vigente_desde <= CURRENT_DATE
    AND (t.vigente_hasta IS NULL OR t.vigente_hasta >= CURRENT_DATE);

DROP FUNCTION IF EXISTS public.crear_embarque_borrador_desde_cotizacion(uuid);

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_company_name text;
  v_org_id uuid;
  v_user_count int;
  v_global_role public.app_role;
  v_skip boolean := coalesce(NEW.raw_user_meta_data->>'skip_auto_org', 'false') = 'true';
BEGIN
  IF v_skip THEN
    RETURN NEW;
  END IF;

  v_company_name := trim(coalesce(NEW.raw_user_meta_data->>'company_name', ''));
  IF length(v_company_name) = 0 THEN v_company_name := 'Mi organización'; END IF;
  IF length(v_company_name) > 120 THEN
    v_company_name := substring(v_company_name FROM 1 FOR 120);
  END IF;

  INSERT INTO public.organizations (nombre, plan, activo)
  VALUES (v_company_name, 'basic', true) RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'admin_org'::public.app_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  SELECT count(*) INTO v_user_count FROM public.user_roles;
  v_global_role := CASE WHEN v_user_count = 0 THEN 'super_admin'::public.app_role
                        ELSE 'admin_org'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_global_role)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.assert_pago_sin_rep_vivo_delete()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF OLD.uuid_rep IS NOT NULL
     AND COALESCE(OLD.estado_rep, 'Pendiente') = 'Timbrado' THEN
    RAISE EXCEPTION 'LC_PAGO_CON_REP_VIVO: el pago tiene un REP timbrado, cancele el REP antes de eliminar'
      USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END $fn$;

DROP TRIGGER IF EXISTS trg_pago_sin_rep_vivo_delete ON public.pagos_factura;
CREATE TRIGGER trg_pago_sin_rep_vivo_delete
  BEFORE DELETE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.assert_pago_sin_rep_vivo_delete();