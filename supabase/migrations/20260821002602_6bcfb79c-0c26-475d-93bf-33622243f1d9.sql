-- Ola 1 — "Candados de horas" (Major Release Elogistix).

CREATE OR REPLACE FUNCTION public.nc_aplicadas_en_moneda_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_moneda text;
  v_tc numeric;
  v_ncs numeric;
BEGIN
  SELECT f.moneda::text, f.tipo_cambio INTO v_moneda, v_tc
  FROM public.facturas f WHERE f.id = p_factura_id;
  IF v_moneda IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(
      CASE
        WHEN nc.moneda::text = v_moneda THEN nc.monto
        WHEN v_moneda = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
          THEN nc.monto * nc.tipo_cambio
        WHEN v_moneda <> 'MXN' AND nc.moneda::text = 'MXN' AND v_tc > 1
          THEN nc.monto / v_tc
        WHEN v_moneda <> 'MXN' AND nc.moneda::text <> 'MXN'
             AND v_moneda <> nc.moneda::text
             AND nc.tipo_cambio > 1 AND v_tc > 1
          THEN (nc.monto * nc.tipo_cambio) / v_tc
        ELSE 0
      END), 0) INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_ncs, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_cancel text;
  v_total numeric;
  v_pagos_otros numeric;
  v_ncs numeric;
  v_saldo_disponible_previo numeric;
  v_saldo_post numeric;
  v_solo_metadatos boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.factura_id IS NOT DISTINCT FROM OLD.factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.monto_aplicado_factura IS NOT DISTINCT FROM OLD.monto_aplicado_factura
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio IS NOT DISTINCT FROM OLD.tipo_cambio
      AND NEW.ret_isr IS NOT DISTINCT FROM OLD.ret_isr
      AND NEW.ret_iva IS NOT DISTINCT FROM OLD.ret_iva
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.fecha_pago IS NOT NULL AND NEW.fecha_pago > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del cobro no puede ser futura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('fecha_pago', NEW.fecha_pago)::text;
  END IF;

  PERFORM 1 FROM public.facturas WHERE id = NEW.factura_id FOR UPDATE;

  SELECT estado::text, COALESCE(total, 0), COALESCE(cancellation_status, 'none')
    INTO v_estado, v_total, v_cancel
  FROM public.facturas
  WHERE id = NEW.factura_id;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_PAGO_FACTURA_NO_VIVA: la factura está en estado % y no admite pagos', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  IF v_cancel IN ('pending','verifying') THEN
    RAISE EXCEPTION 'LC_FACTURA_EN_CANCELACION: la factura tiene una cancelación en trámite ante el SAT y no admite cobros'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('cancellation_status', v_cancel)::text;
  END IF;

  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_pagos_otros
  FROM public.pagos_factura pf
  WHERE pf.factura_id = NEW.factura_id
    AND pf.deleted_at IS NULL
    AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_ncs := public.nc_aplicadas_en_moneda_factura(NEW.factura_id);

  v_saldo_disponible_previo := v_total - v_pagos_otros - v_ncs;
  v_saldo_post := v_saldo_disponible_previo - COALESCE(NEW.monto_aplicado_factura, 0);

  IF v_saldo_post < -0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'saldo_disponible', v_saldo_disponible_previo,
              'monto_intentado', NEW.monto_aplicado_factura,
              'notas_credito_aplicadas', v_ncs
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_factura_viva_para_pago() FROM anon;

CREATE OR REPLACE FUNCTION public.revertir_proforma_al_cancelar_sustitucion(p_factura_id uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_liberadas uuid[] := ARRAY[]::uuid[];
  v_facturas_vivas int;
  v_proforma_id_directa uuid;
  v_org uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF p_factura_id IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_REQUERIDA: falta el identificador de la factura'
      USING ERRCODE = '22023';
  END IF;

  SELECT organization_id, proforma_id INTO v_org, v_proforma_id_directa
  FROM public.facturas WHERE id = p_factura_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_NO_EXISTE: la factura no existe' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: sesión requerida' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_org_member(v_org) THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: la factura pertenece a otra organización'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_proforma_id_directa IS NOT NULL THEN
    v_ids := array_append(v_ids, v_proforma_id_directa);
  END IF;

  v_ids := v_ids || COALESCE(
    (SELECT array_agg(DISTINCT proforma_id_origen)
       FROM public.conceptos_factura
      WHERE factura_id = p_factura_id
        AND deleted_at IS NULL
        AND proforma_id_origen IS NOT NULL),
    ARRAY[]::uuid[]
  );

  v_ids := array(
    SELECT DISTINCT x FROM unnest(v_ids) AS x WHERE x IS NOT NULL
  );

  IF array_length(v_ids, 1) IS NULL THEN
    RETURN v_liberadas;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT count(*) INTO v_facturas_vivas
    FROM public.facturas f
    WHERE f.estado NOT IN ('Cancelada','Sustituida')
      AND f.id <> p_factura_id
      AND (
        f.proforma_id = v_id
        OR EXISTS (
          SELECT 1 FROM public.conceptos_factura cf
           WHERE cf.factura_id = f.id
             AND cf.deleted_at IS NULL
             AND cf.proforma_id_origen = v_id
        )
      );

    IF v_facturas_vivas = 0 THEN
      UPDATE public.proformas
         SET estado_proforma   = 'pendiente',
             fecha_facturacion = NULL,
             updated_at        = now()
       WHERE id = v_id
         AND organization_id = v_org
         AND estado_proforma = 'facturada';

      IF FOUND THEN
        v_liberadas := array_append(v_liberadas, v_id);
        INSERT INTO public.bitacora_actividad (
          organization_id, usuario_id, usuario_email,
          accion, modulo, entidad_id, entidad_nombre, detalles
        ) VALUES (
          v_org, v_uid, NULL,
          'revertir_proforma_cancelacion_sustitucion', 'facturacion',
          v_id, NULL,
          jsonb_build_object('factura_id', p_factura_id)
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_liberadas;
END;
$function$;

REVOKE ALL ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revertir_proforma_al_cancelar_sustitucion(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.limpiar_cancellation_status_verificado(p_factura_id uuid, p_remote_cancellation_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_factura record;
  v_email text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NULLIF(TRIM(p_remote_cancellation_status), ''), '') <> '' THEN
    RAISE EXCEPTION 'facturapi_reporta_cancelacion_activa' USING ERRCODE = '22023';
  END IF;

  SELECT id, organization_id, cancellation_status, cancelado_en, acuse_cancelacion_status, numero
    INTO v_factura
    FROM public.facturas
   WHERE id = p_factura_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'factura_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_role(v_user, 'admin'::public.app_role)
    OR public.has_role(v_user, 'admin_org'::public.app_role)
    OR public.has_role(v_user, 'super_admin'::public.app_role)
    OR public.has_role(v_user, 'contador'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden_role' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_org_member(v_factura.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: la factura pertenece a otra organización'
      USING ERRCODE = '42501';
  END IF;

  IF v_factura.cancelado_en IS NOT NULL OR v_factura.acuse_cancelacion_status IS NOT NULL THEN
    RAISE EXCEPTION 'factura_ya_cancelada' USING ERRCODE = '22023';
  END IF;

  IF v_factura.cancellation_status NOT IN ('pending', 'verifying') THEN
    RAISE EXCEPTION 'factura_no_esta_pendiente' USING ERRCODE = '22023';
  END IF;

  UPDATE public.facturas
     SET cancellation_status = NULL,
         cancelacion_solicitada_en = NULL,
         cancelacion_vence_en = NULL
   WHERE id = p_factura_id;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;

  INSERT INTO public.bitacora_actividad
    (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, detalles)
  VALUES (
    v_factura.organization_id,
    v_user,
    v_email,
    'facturacion',
    'facturapi_pending_limpiada_manual',
    v_factura.id,
    jsonb_build_object(
      'numero', v_factura.numero,
      'cancellation_status_previo', v_factura.cancellation_status,
      'verificado_via', 'facturapi-consultar (GET /invoices/{id})'
    )
  );

  RETURN jsonb_build_object('ok', true, 'factura_id', p_factura_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.limpiar_cancellation_status_verificado(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.limpiar_cancellation_status_verificado(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.limpiar_cancellation_status_verificado(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.archivar_version_cotizacion(p_cotizacion_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_version INT;
  v_org UUID;
  v_uid UUID := auth.uid();
BEGIN
  SELECT version, organization_id INTO v_version, v_org
  FROM public.cotizaciones WHERE id = p_cotizacion_id;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Cotización % no encontrada', p_cotizacion_id USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: sesión requerida' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_org_member(v_org) THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: la cotización pertenece a otra organización'
        USING ERRCODE = '42501';
    END IF;
    IF NOT public.puede_escribir_cotizaciones(v_uid) THEN
      RAISE EXCEPTION 'LC_COTIZACION_SIN_PERMISO: tu rol no puede archivar versiones de cotización'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.cotizacion_costos_historico (
    cotizacion_id, version, organization_id, origen_costo_id, concepto, proveedor, cantidad, unidad_medida,
    costo_unitario, costo_total, precio_venta, precio_total, profit, porcentaje_profit, moneda, notas,
    costeo_tarifa_id, costeo_tarifa_recargo_id, archivada_por, motivo)
  SELECT cc.cotizacion_id, v_version, cc.organization_id, cc.id, cc.concepto, cc.proveedor, cc.cantidad, cc.unidad_medida,
    cc.costo_unitario, cc.costo_total, cc.precio_venta, cc.precio_total, cc.profit, cc.porcentaje_profit, cc.moneda, cc.notas,
    cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id, v_uid, p_motivo
  FROM public.cotizacion_costos cc
  WHERE cc.cotizacion_id = p_cotizacion_id AND cc.deleted_at IS NULL;

  PERFORM public.registrar_bitacora('cotizaciones','archivar_version_costos',p_cotizacion_id,'',
    jsonb_build_object('version', v_version, 'motivo', COALESCE(p_motivo,'')), v_org, v_uid);

  RETURN v_version;
END;
$function$;

REVOKE ALL ON FUNCTION public.archivar_version_cotizacion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archivar_version_cotizacion(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.archivar_version_cotizacion(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tc_dof_upsert_manual(_fecha date, _usd numeric, _eur numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_previo record;
  v_email text;
BEGIN
  IF NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_TC_DOF_FORBIDDEN: el tipo de cambio DOF es un catálogo global de la plataforma; sólo un super administrador puede capturarlo'
      USING ERRCODE = '42501';
  END IF;

  IF _usd IS NULL OR _usd <= 0 THEN
    RAISE EXCEPTION 'LC_TC_DOF_INVALIDO: el tipo de cambio USD debe ser mayor a cero'
      USING ERRCODE = '22023';
  END IF;

  IF _fecha IS NULL OR _fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_TC_DOF_FECHA_INVALIDA: la fecha del tipo de cambio no puede ser futura'
      USING ERRCODE = '22023';
  END IF;

  SELECT fecha, usd_mxn, eur_mxn INTO v_previo
  FROM public.tipos_cambio_dof WHERE fecha = _fecha;

  INSERT INTO public.tipos_cambio_dof (fecha, usd_mxn, eur_mxn, fuente, origen)
  VALUES (_fecha, _usd, NULLIF(_eur, 0), 'banxico_sie', 'manual')
  ON CONFLICT (fecha) DO UPDATE
    SET usd_mxn = EXCLUDED.usd_mxn,
        eur_mxn = COALESCE(EXCLUDED.eur_mxn, public.tipos_cambio_dof.eur_mxn),
        origen  = 'manual',
        updated_at = now();

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
    VALUES (
      public.current_user_org_id(), v_uid, COALESCE(v_email, ''),
      'catalogos', 'tc_dof_upsert_manual', NULL, _fecha::text,
      jsonb_build_object(
        'fecha', _fecha,
        'usd_mxn', _usd,
        'eur_mxn', NULLIF(_eur, 0),
        'usd_mxn_previo', v_previo.usd_mxn,
        'eur_mxn_previo', v_previo.eur_mxn,
        'alcance', 'global_plataforma'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en tc_dof_upsert_manual: % %', SQLSTATE, SQLERRM;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.tc_dof_upsert_manual(date, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tc_dof_upsert_manual(date, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.tc_dof_upsert_manual(date, numeric, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registrar_comision_pendiente(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_comision_pendiente(uuid, uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.registrar_comision_pendiente(uuid, uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_comision_pendiente(uuid, uuid, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.generar_liquidacion_comision(p_vendedora_id uuid, p_periodo text, p_organization_id uuid, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric(14,2);
  v_liq_id uuid;
  v_org uuid;
  v_cached jsonb;
BEGIN
  IF NOT has_any_role_efectivo(auth.uid(),
        ARRAY['admin','admin_org','contador','tesorero']::app_role[]) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_cached := public.idempotency_claim(p_request_id, 'generar_liquidacion_comision');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_LIQUIDACION_EN_PROCESO: Esta liquidación ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN (v_cached->>'liquidacion_id')::uuid;
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(comision_mxn), 0) INTO v_total
    FROM public.comisiones_devengadas
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') = p_periodo;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sin comisiones devengadas para liquidar';
  END IF;

  INSERT INTO public.liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_vendedora_id, p_periodo, v_total, auth.uid())
  RETURNING id INTO v_liq_id;

  UPDATE public.comisiones_devengadas
     SET estado = 'Liquidada', liquidacion_id = v_liq_id, updated_at = now()
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') = p_periodo;

  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('liquidacion_id', v_liq_id, 'total_mxn', v_total));

  RETURN v_liq_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) TO authenticated, service_role;

DROP TRIGGER IF EXISTS update_anticipos_aplicaciones_updated_at ON public.anticipos_aplicaciones;
CREATE TRIGGER update_anticipos_aplicaciones_updated_at
  BEFORE UPDATE ON public.anticipos_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_anticipos_proveedor_updated_at ON public.anticipos_proveedor;
CREATE TRIGGER update_anticipos_proveedor_updated_at
  BEFORE UPDATE ON public.anticipos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_configuracion_global_updated_at ON public.configuracion_global;
CREATE TRIGGER update_configuracion_global_updated_at
  BEFORE UPDATE ON public.configuracion_global
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_comentarios_oportunidad_updated_at ON public.crm_comentarios_oportunidad;
CREATE TRIGGER update_crm_comentarios_oportunidad_updated_at
  BEFORE UPDATE ON public.crm_comentarios_oportunidad
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_plantillas_mensaje_updated_at ON public.crm_plantillas_mensaje;
CREATE TRIGGER update_crm_plantillas_mensaje_updated_at
  BEFORE UPDATE ON public.crm_plantillas_mensaje
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();