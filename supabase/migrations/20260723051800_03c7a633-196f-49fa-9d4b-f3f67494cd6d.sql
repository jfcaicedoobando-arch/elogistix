
CREATE OR REPLACE FUNCTION public.tg_pago_proveedor_no_sobrepago()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_total numeric; v_ncs numeric; v_pagos numeric; v_saldo numeric; v_delta numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.deleted_at IS NULL THEN
    v_delta := COALESCE(NEW.monto_en_moneda_factura,0) - COALESCE(OLD.monto_en_moneda_factura,0);
  ELSE
    v_delta := COALESCE(NEW.monto_en_moneda_factura,0);
  END IF;
  IF v_delta <= 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(total,0) INTO v_total FROM public.proveedor_facturas WHERE id=NEW.proveedor_factura_id;
  SELECT COALESCE(SUM(monto),0) INTO v_ncs FROM public.proveedor_notas_credito
    WHERE proveedor_factura_id=NEW.proveedor_factura_id AND deleted_at IS NULL AND estado::text='Aplicada';
  SELECT COALESCE(SUM(monto_en_moneda_factura),0) INTO v_pagos FROM public.pagos_proveedor
    WHERE proveedor_factura_id=NEW.proveedor_factura_id AND deleted_at IS NULL
      AND (TG_OP<>'UPDATE' OR id<>NEW.id);
  v_saldo := v_total - v_ncs - v_pagos;
  IF v_delta > v_saldo + 0.005 THEN
    RAISE EXCEPTION 'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura de proveedor',
      round(v_delta,2), round(v_saldo,2) USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_pagos_proveedor_monto_convertido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_fact_moneda public.moneda; v_fact_tc numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT moneda, tipo_cambio_usd INTO v_fact_moneda, v_fact_tc
    FROM public.proveedor_facturas WHERE id=NEW.proveedor_factura_id;
  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROV_NO_ENCONTRADA: factura % no existe', NEW.proveedor_factura_id USING ERRCODE='P0002';
  END IF;
  NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
    NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc);
  IF NEW.moneda='MXN'::public.moneda AND v_fact_moneda='USD'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn := ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSE
    NEW.diferencia_cambiaria_mxn := NULL;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb; v_puede boolean := true; v_ok boolean;
  v_cxc_saldo numeric := 0; v_cxc_por_moneda jsonb := '[]'::jsonb;
  v_cxp_saldo numeric := 0; v_cxp_por_moneda jsonb := '[]'::jsonb;
  v_docs_faltantes int;
  v_utilidad_mxn numeric; v_venta_mxn numeric; v_margen_min numeric; v_margen_pct numeric;
  v_pnl jsonb; v_com_count int;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
  v_caller_org uuid; v_uid uuid; v_is_service boolean;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id=p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();
  v_is_service := (COALESCE(auth.role()::text,'') = 'service_role');
  IF NOT v_is_service AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_emb.organization_id <> v_caller_org THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: sin acceso al embarque' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_emb.modo='Marítimo' AND COALESCE(v_emb.tipo_carga,'') ILIKE 'FCL%' THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cont_incompletos, v_cont_ids
    FROM embarque_contenedores WHERE embarque_id=p_embarque_id AND deleted_at IS NULL
      AND (peso_kg IS NULL OR peso_kg<=0 OR volumen_m3 IS NULL OR volumen_m3<=0);
    v_ok := (v_cont_incompletos=0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_datos_completos','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_incompletos', v_cont_incompletos, 'ids', v_cont_ids)));
  END IF;

  SELECT EXISTS (SELECT 1 FROM embarque_contenedores
    WHERE embarque_id=p_embarque_id AND deleted_at IS NULL) INTO v_tiene_contenedores;
  IF v_tiene_contenedores THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cont_sin_fechas, v_cont_fechas_ids
    FROM embarque_contenedores WHERE embarque_id=p_embarque_id AND deleted_at IS NULL
      AND (fecha_descarga IS NULL OR fecha_devolucion IS NULL);
    v_ok := (v_cont_sin_fechas=0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_fechas_completas','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_sin_fechas', v_cont_sin_fechas, 'ids', v_cont_fechas_ids)));
  END IF;

  SELECT COUNT(*) INTO v_docs_faltantes FROM documentos_embarque de
   WHERE de.embarque_id=p_embarque_id AND de.deleted_at IS NULL
     AND (de.archivo IS NULL OR de.archivo='') AND de.estado<>'No aplica';
  v_ok := (v_docs_faltantes=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));

  SELECT COUNT(*) INTO v_costos_sin_factura FROM conceptos_costo cc
   WHERE cc.embarque_id=p_embarque_id AND cc.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM proveedor_facturas_conceptos pfc
       JOIN proveedor_facturas pf2 ON pf2.id=pfc.proveedor_factura_id
       WHERE pfc.concepto_costo_id=cc.id AND pf2.deleted_at IS NULL AND pf2.estado<>'Cancelada');
  v_ok := (v_costos_sin_factura=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','costo_conceptos_con_factura','ok',v_ok,
    'detalle', jsonb_build_object('sin_factura', v_costos_sin_factura)));

  WITH agg AS (
    SELECT COALESCE(pf.moneda,'MXN') AS moneda, COALESCE(SUM(pf.total),0) AS total,
      COALESCE(SUM((SELECT COALESCE(SUM(pp.monto),0) FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL)),0) AS pagado,
      COUNT(*) FILTER (WHERE pf.total > COALESCE((
        SELECT SUM(pp.monto) FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL),0) + 0.01) AS facturas_pendientes
    FROM proveedor_facturas pf
    WHERE pf.embarque_id=p_embarque_id AND pf.deleted_at IS NULL AND pf.estado<>'Cancelada'
    GROUP BY COALESCE(pf.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,
      'saldo',GREATEST(total-pagado,0),'facturas_pendientes',facturas_pendientes
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(total-pagado,0)),0)
  INTO v_cxp_por_moneda, v_cxp_saldo FROM agg;
  v_ok := (v_cxp_saldo <= 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxp_por_moneda, 'saldo_total', v_cxp_saldo)));

  SELECT COUNT(*) FILTER (WHERE estado_facturacion='pendiente'),
         COUNT(*) FILTER (WHERE estado_facturacion='en_proforma')
    INTO v_venta_pendientes, v_venta_en_proforma
    FROM conceptos_venta WHERE embarque_id=p_embarque_id AND deleted_at IS NULL;
  v_ok := (v_venta_pendientes=0 AND v_venta_en_proforma=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','venta_conceptos_facturados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_venta_pendientes, 'en_proforma', v_venta_en_proforma)));

  WITH agg AS (
    SELECT COALESCE(f.moneda,'MXN') AS moneda, COALESCE(SUM(f.total),0) AS total,
      COALESCE(SUM(public.saldo_factura(f.id)),0) AS saldo,
      COALESCE(SUM((SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) FROM pagos_factura pf
        WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL)),0) AS pagado,
      COALESCE(SUM((SELECT COALESCE(SUM(nc.monto),0) FROM factura_notas_credito nc
        WHERE nc.factura_id=f.id AND nc.deleted_at IS NULL AND nc.estado='Aplicada')),0) AS notas_credito,
      COUNT(*) FILTER (WHERE public.saldo_factura(f.id) > 0.01) AS facturas_pendientes
    FROM facturas f
    WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
      AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
    GROUP BY COALESCE(f.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,'notas_credito',notas_credito,
      'saldo',GREATEST(saldo,0),'facturas_pendientes',facturas_pendientes
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(saldo,0)),0)
  INTO v_cxc_por_moneda, v_cxc_saldo FROM agg;
  v_ok := (v_cxc_saldo <= 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxc_por_moneda, 'saldo_total', v_cxc_saldo)));

  SELECT COUNT(*), COALESCE(array_agg(pf.id), ARRAY[]::uuid[]) INTO v_rep_pendientes, v_rep_ids
    FROM pagos_factura pf JOIN facturas f ON f.id=pf.factura_id
   WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
     AND pf.deleted_at IS NULL AND f.metodo_pago='PPD'
     AND COALESCE(pf.estado_rep,'Pendiente') NOT IN ('Timbrado','No aplica');
  v_ok := (v_rep_pendientes=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','rep_timbrados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_rep_pendientes, 'ids', v_rep_ids)));

  SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas
   WHERE embarque_id=p_embarque_id AND definitiva=false;
  v_ok := (v_com_count=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comisiones_definitivas','ok',v_ok,
    'detalle', jsonb_build_object('no_definitivas', v_com_count)));

  BEGIN
    v_pnl := public.pnl_financiero_embarque(p_embarque_id);
    v_utilidad_mxn := COALESCE((v_pnl->>'utilidad_mxn')::numeric, 0);
    v_venta_mxn := COALESCE(
      (v_pnl->'venta'->>'real_mxn')::numeric,
      (v_pnl->>'venta_mxn')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_utilidad_mxn := 0; v_venta_mxn := 0;
  END;

  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global
     WHERE categoria='fiscal' AND clave='pnl_margen_minimo_cierre' LIMIT 1), 0) INTO v_margen_min;

  v_margen_pct := CASE WHEN v_venta_mxn>0 THEN ROUND(v_utilidad_mxn/v_venta_mxn*100.0,2) ELSE NULL END;
  v_ok := (v_margen_pct IS NOT NULL) AND (v_margen_pct >= v_margen_min);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object(
      'utilidad_mxn', v_utilidad_mxn, 'venta_mxn', v_venta_mxn,
      'margen_pct', v_margen_pct, 'minimo_pct', v_margen_min)));

  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END $function$;

INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id, 'cotizacion',
       COALESCE(MAX((substring(folio from '(\d+)$'))::int), 0)
FROM public.cotizaciones
WHERE folio ~ '\d+$' AND deleted_at IS NULL AND organization_id IS NOT NULL
GROUP BY organization_id
ON CONFLICT (organization_id, tipo) DO UPDATE
  SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero),
      updated_at = now();

INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id, 'factura',
       COALESCE(MAX((substring(numero from '(\d+)$'))::int), 0)
FROM public.facturas
WHERE numero ~ '\d+$' AND deleted_at IS NULL AND organization_id IS NOT NULL
  AND numero NOT LIKE 'BORRADOR-%'
GROUP BY organization_id
ON CONFLICT (organization_id, tipo) DO UPDATE
  SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero),
      updated_at = now();

INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id, 'proforma',
       COALESCE(MAX((substring(numero from '(\d+)$'))::int), 0)
FROM public.proformas
WHERE numero ~ '\d+$' AND deleted_at IS NULL AND organization_id IS NOT NULL
GROUP BY organization_id
ON CONFLICT (organization_id, tipo) DO UPDATE
  SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero),
      updated_at = now();

INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id, 'embarque',
       COALESCE(MAX((substring(expediente from '(\d+)$'))::int), 0)
FROM public.embarques
WHERE expediente ~ '\d+$' AND deleted_at IS NULL AND organization_id IS NOT NULL
GROUP BY organization_id
ON CONFLICT (organization_id, tipo) DO UPDATE
  SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero),
      updated_at = now();

CREATE OR REPLACE FUNCTION public.cxp_aging_proveedores(p_org uuid DEFAULT NULL::uuid, p_fecha date DEFAULT CURRENT_DATE)
RETURNS TABLE(proveedor_id uuid, proveedor_nombre text, saldo_total numeric, vigente numeric, d_1_30 numeric, d_31_60 numeric, d_61_90 numeric, mas_90 numeric, num_facturas integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_org uuid := public.current_user_org_id(); v_org uuid;
        v_is_super boolean := public.has_role(auth.uid(),'super_admin'::app_role);
BEGIN
  IF v_caller_org IS NULL AND NOT v_is_super THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organización activa' USING ERRCODE='42501';
  END IF;
  IF v_is_super THEN v_org := p_org;
  ELSIF p_org IS NOT NULL AND p_org <> v_caller_org THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes consultar el aging de otra organización' USING ERRCODE='42501';
  ELSE v_org := v_caller_org;
  END IF;
  RETURN QUERY
  WITH pagado AS (
    SELECT proveedor_factura_id, COALESCE(SUM(COALESCE(monto_en_moneda_factura, monto)),0) AS pagado
      FROM public.pagos_proveedor WHERE deleted_at IS NULL GROUP BY proveedor_factura_id
  ), nc AS (
    SELECT proveedor_factura_id, COALESCE(SUM(monto),0) AS aplicado
      FROM public.proveedor_notas_credito WHERE estado='Aplicada' GROUP BY proveedor_factura_id
  ), saldos AS (
    SELECT pf.proveedor_id, pf.proveedor_nombre, pf.id AS factura_id,
           GREATEST(pf.total - COALESCE(pg.pagado,0) - COALESCE(nc.aplicado,0),0) AS saldo,
           (p_fecha - COALESCE(pf.fecha_vencimiento, pf.fecha_emision))::int AS dias_vencido
      FROM public.proveedor_facturas pf
      LEFT JOIN pagado pg ON pg.proveedor_factura_id=pf.id
      LEFT JOIN nc       ON nc.proveedor_factura_id=pf.id
     WHERE pf.deleted_at IS NULL AND pf.estado<>'Cancelada'
       AND (v_org IS NULL OR pf.organization_id=v_org))
  SELECT s.proveedor_id, MAX(s.proveedor_nombre), SUM(s.saldo),
    SUM(CASE WHEN s.dias_vencido<=0 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 1  AND 30 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido > 90 THEN s.saldo ELSE 0 END),
    COUNT(*)::int
  FROM saldos s WHERE s.saldo > 0.005
  GROUP BY s.proveedor_id ORDER BY SUM(s.saldo) DESC;
END; $function$;

CREATE OR REPLACE FUNCTION public.guard_estado_factura()
RETURNS trigger LANGUAGE plpgsql
AS $function$
DECLARE v_pagos_vivos int; v_bypass boolean;
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF OLD.estado = 'Cancelada'::estado_factura THEN
    RAISE EXCEPTION 'LC_FAC_REAPERTURA: una factura cancelada no puede reabrirse' USING ERRCODE='P0001';
  END IF;
  IF NEW.estado = 'Cancelada'::estado_factura THEN
    SELECT count(*) INTO v_pagos_vivos FROM public.pagos_factura
      WHERE factura_id=OLD.id AND deleted_at IS NULL;
    IF v_pagos_vivos > 0 THEN
      RAISE EXCEPTION 'LC_FAC_CANCEL_CON_PAGOS: revierta los % pagos vivos antes de cancelar', v_pagos_vivos USING ERRCODE='P0001';
    END IF;
  END IF;
  v_bypass := (current_setting('app.recalc_estado_factura', true) = '1')
              AND (
                COALESCE(auth.role()::text,'') = 'service_role'
                OR current_user = 'postgres'
                OR public.has_role(auth.uid(),'super_admin'::app_role)
              );
  IF NEW.estado IN ('Pagada'::estado_factura,'Parcialmente pagada'::estado_factura,'Vencida'::estado_factura)
     AND NOT v_bypass THEN
    RAISE EXCEPTION 'LC_FAC_ESTADO_CALCULADO: el estado % sólo puede fijarlo el recálculo automático', NEW.estado USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_proforma_eur_no_soportada()
RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.estado_proforma='facturada' AND (OLD.estado_proforma IS DISTINCT FROM 'facturada') THEN
    IF EXISTS (
      SELECT 1 FROM public.conceptos_venta cv
      WHERE cv.proforma_id=NEW.id AND cv.deleted_at IS NULL AND cv.moneda='EUR'::public.moneda
    ) OR EXISTS (
      SELECT 1 FROM public.proforma_conceptos_consolidados pcc
      WHERE pcc.proforma_id=NEW.id AND pcc.deleted_at IS NULL AND pcc.moneda='EUR'::public.moneda
    ) THEN
      RAISE EXCEPTION 'LC_MONEDA_NO_SOPORTADA: la conversión de proformas con conceptos en EUR aún no está soportada'
        USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_proforma_eur_no_soportada ON public.proformas;
CREATE TRIGGER trg_proforma_eur_no_soportada
  BEFORE UPDATE OF estado_proforma ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.tg_proforma_eur_no_soportada();

CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_count integer; v_uid uuid; v_org uuid; v_is_service boolean;
BEGIN
  PERFORM set_config('app.recalc_estado_factura','1', true);
  v_uid := auth.uid();
  v_org := public.current_user_org_id();
  v_is_service := (COALESCE(auth.role()::text,'') = 'service_role');
  UPDATE public.facturas
     SET estado = 'Vencida'::estado_factura, updated_at = now()
   WHERE estado::text IN ('Emitida','Parcialmente pagada')
     AND fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE
     AND deleted_at IS NULL
     AND (v_is_service OR public.has_role(v_uid,'super_admin'::app_role)
          OR (v_org IS NOT NULL AND organization_id=v_org));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.recalc_estado_factura','0', true);
  RETURN v_count;
END $function$;

UPDATE public.proformas p
   SET factura_id = f.id
  FROM public.facturas f
 WHERE f.proforma_id=p.id AND p.factura_id IS NULL
   AND f.deleted_at IS NULL AND p.deleted_at IS NULL
   AND f.estado NOT IN ('Cancelada'::estado_factura,'Sustituida'::estado_factura);

CREATE OR REPLACE FUNCTION public.tg_facturas_link_proforma()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.proforma_id IS NOT NULL AND NEW.deleted_at IS NULL
     AND NEW.estado NOT IN ('Cancelada'::estado_factura,'Sustituida'::estado_factura) THEN
    UPDATE public.proformas
       SET factura_id = NEW.id
     WHERE id = NEW.proforma_id
       AND (factura_id IS NULL OR factura_id <> NEW.id)
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_facturas_link_proforma ON public.facturas;
CREATE TRIGGER trg_facturas_link_proforma
  AFTER INSERT OR UPDATE OF proforma_id, estado, deleted_at ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.tg_facturas_link_proforma();
