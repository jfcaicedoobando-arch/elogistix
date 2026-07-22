
-- Idéntico al intento previo salvo el bloque de renombrado de duplicados (FIX-R2-15).

CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_factura_id uuid; v_total numeric; v_pagado numeric; v_nc numeric;
  v_saldo numeric; v_vencimiento date;
  v_estado_actual estado_factura; v_nuevo_estado estado_factura;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);
  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;
  IF v_estado_actual IN ('Cancelada','Borrador','Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_saldo := public.saldo_factura(v_factura_id);
  SELECT COALESCE(SUM(monto_aplicado_factura),0) INTO v_pagado
    FROM pagos_factura WHERE factura_id = v_factura_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(monto),0) INTO v_nc
    FROM public.factura_notas_credito
   WHERE factura_id = v_factura_id AND estado = 'Aplicada' AND deleted_at IS NULL;
  v_pagado := v_pagado + v_nc;
  IF v_saldo <= 0.01 THEN v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN v_nuevo_estado := 'Vencida';
  ELSE v_nuevo_estado := 'Emitida';
  END IF;
  PERFORM set_config('app.recalc_estado_factura','1',true);
  UPDATE facturas SET estado = v_nuevo_estado, updated_at = now()
   WHERE id = v_factura_id AND estado IS DISTINCT FROM v_nuevo_estado;
  PERFORM set_config('app.recalc_estado_factura','0',true);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calc_pago_retenciones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_fac_subtotal numeric; v_fac_iva numeric;
  v_fac_ret_isr numeric; v_fac_ret_iva numeric;
  v_base numeric; v_ratio numeric;
BEGIN
  IF COALESCE(NEW.ret_isr,0) > 0 OR COALESCE(NEW.ret_iva,0) > 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(subtotal,0), COALESCE(iva,0), COALESCE(ret_isr,0), COALESCE(ret_iva,0)
    INTO v_fac_subtotal, v_fac_iva, v_fac_ret_isr, v_fac_ret_iva
    FROM public.facturas WHERE id = NEW.factura_id;
  v_base := v_fac_subtotal + v_fac_iva - v_fac_ret_iva - v_fac_ret_isr;
  IF v_base > 0 AND COALESCE(NEW.monto_aplicado_factura,0) > 0 THEN
    v_ratio := NEW.monto_aplicado_factura / v_base;
    NEW.ret_isr := ROUND(v_fac_ret_isr * v_ratio, 2);
    NEW.ret_iva := ROUND(v_fac_ret_iva * v_ratio, 2);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_estado_factura()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_pagos_vivos int;
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF OLD.estado = 'Cancelada'::estado_factura THEN
    RAISE EXCEPTION 'LC_FAC_REAPERTURA: una factura cancelada no puede reabrirse' USING ERRCODE='P0001';
  END IF;
  IF NEW.estado = 'Cancelada'::estado_factura THEN
    SELECT count(*) INTO v_pagos_vivos FROM public.pagos_factura
      WHERE factura_id = OLD.id AND deleted_at IS NULL;
    IF v_pagos_vivos > 0 THEN
      RAISE EXCEPTION 'LC_FAC_CANCEL_CON_PAGOS: revierta los % pagos vivos antes de cancelar', v_pagos_vivos USING ERRCODE='P0001';
    END IF;
  END IF;
  IF NEW.estado IN ('Pagada'::estado_factura,'Parcialmente pagada'::estado_factura,'Vencida'::estado_factura)
     AND current_setting('app.recalc_estado_factura', true) IS DISTINCT FROM '1'
     AND NOT public.has_role(auth.uid(),'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_FAC_ESTADO_CALCULADO: el estado % sólo puede fijarlo el recálculo automático', NEW.estado USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_estado_factura ON public.facturas;
CREATE TRIGGER trg_guard_estado_factura
  BEFORE UPDATE OF estado ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.guard_estado_factura();

DO $$
BEGIN
  UPDATE public.pagos_proveedor SET tipo_cambio_usd = 1 WHERE tipo_cambio_usd IS NULL OR tipo_cambio_usd <= 0;
  UPDATE public.pagos_factura   SET tipo_cambio     = 1 WHERE tipo_cambio     IS NOT NULL AND tipo_cambio     <= 0;

  UPDATE public.pagos_proveedor SET deleted_at = COALESCE(deleted_at, now()),
         motivo_ajuste = COALESCE(motivo_ajuste,'') || ' [autofix: monto<=0]'
   WHERE monto <= 0 AND deleted_at IS NULL;
  UPDATE public.pagos_factura SET deleted_at = COALESCE(deleted_at, now())
   WHERE monto <= 0 AND deleted_at IS NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pagos_proveedor_monto_pos') THEN
    ALTER TABLE public.pagos_proveedor ADD CONSTRAINT pagos_proveedor_monto_pos
      CHECK (deleted_at IS NOT NULL OR monto > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pagos_factura_monto_pos') THEN
    ALTER TABLE public.pagos_factura ADD CONSTRAINT pagos_factura_monto_pos
      CHECK (deleted_at IS NOT NULL OR monto > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pagos_proveedor_tc_pos') THEN
    ALTER TABLE public.pagos_proveedor ADD CONSTRAINT pagos_proveedor_tc_pos
      CHECK (tipo_cambio_usd > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pagos_factura_tc_pos') THEN
    ALTER TABLE public.pagos_factura ADD CONSTRAINT pagos_factura_tc_pos
      CHECK (tipo_cambio IS NULL OR tipo_cambio > 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cxp_por_pagar()
RETURNS TABLE(
  factura_id uuid, proveedor_nombre text, folio_proveedor text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_para_vencer integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  estado_captura text, tipo_cambio_usd numeric)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH pagos_conv AS (
    SELECT pp.proveedor_factura_id,
           SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)) AS pagado
      FROM public.pagos_proveedor pp
     WHERE pp.deleted_at IS NULL
     GROUP BY pp.proveedor_factura_id
  )
  SELECT pf.id, pf.proveedor_nombre, pf.folio_proveedor,
    pf.embarque_id, e.expediente,
    pf.fecha_emision, pf.fecha_vencimiento,
    (pf.fecha_vencimiento - CURRENT_DATE)::int,
    pf.moneda::text, pf.total,
    COALESCE(pc.pagado,0),
    pf.total - COALESCE(pc.pagado,0),
    pf.estado_captura, pf.tipo_cambio_usd
  FROM public.proveedor_facturas pf
  LEFT JOIN public.embarques e ON e.id = pf.embarque_id
  LEFT JOIN pagos_conv pc ON pc.proveedor_factura_id = pf.id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente'
  ORDER BY pf.fecha_vencimiento NULLS LAST, pf.created_at DESC
  LIMIT 500;
$function$;

CREATE OR REPLACE FUNCTION public.cxp_aging_proveedores(p_org uuid DEFAULT NULL, p_fecha date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  proveedor_id uuid, proveedor_nombre text,
  saldo_total numeric, vigente numeric,
  d_1_30 numeric, d_31_60 numeric, d_61_90 numeric, mas_90 numeric,
  num_facturas integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id(); v_org uuid;
BEGIN
  IF v_caller_org IS NULL THEN v_org := p_org;
  ELSIF p_org IS NOT NULL AND p_org <> v_caller_org
        AND NOT public.has_role(auth.uid(),'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes consultar el aging de otra organización' USING ERRCODE='42501';
  ELSE v_org := v_caller_org;
  END IF;

  RETURN QUERY
  WITH pagado AS (
    SELECT proveedor_factura_id,
           COALESCE(SUM(COALESCE(monto_en_moneda_factura, monto)),0) AS pagado
      FROM public.pagos_proveedor WHERE deleted_at IS NULL
     GROUP BY proveedor_factura_id
  ), nc AS (
    SELECT proveedor_factura_id, COALESCE(SUM(monto),0) AS aplicado
      FROM public.proveedor_notas_credito WHERE estado='Aplicada'
     GROUP BY proveedor_factura_id
  ), saldos AS (
    SELECT pf.proveedor_id, pf.proveedor_nombre, pf.id AS factura_id,
           GREATEST(pf.total - COALESCE(pg.pagado,0) - COALESCE(nc.aplicado,0),0) AS saldo,
           (p_fecha - COALESCE(pf.fecha_vencimiento, pf.fecha_emision))::int AS dias_vencido
      FROM public.proveedor_facturas pf
      LEFT JOIN pagado pg ON pg.proveedor_factura_id = pf.id
      LEFT JOIN nc       ON nc.proveedor_factura_id = pf.id
     WHERE pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
       AND (v_org IS NULL OR pf.organization_id = v_org)
  )
  SELECT s.proveedor_id, MAX(s.proveedor_nombre),
    SUM(s.saldo),
    SUM(CASE WHEN s.dias_vencido<=0 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 1  AND 30 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido > 90 THEN s.saldo ELSE 0 END),
    COUNT(*)::int
  FROM saldos s WHERE s.saldo > 0.005
  GROUP BY s.proveedor_id ORDER BY SUM(s.saldo) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_version INT; v_org UUID; v_folio TEXT;
  v_estado_actual TEXT; v_vigencia DATE;
BEGIN
  SELECT version, organization_id, folio, estado::text, fecha_vigencia
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia
    FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de aceptar', v_vigencia USING ERRCODE='P0001';
  END IF;
  IF v_estado_actual NOT IN ('Borrador','Enviada') THEN
    RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Enviada (actual: %)', v_estado_actual;
  END IF;
  UPDATE cotizaciones
     SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
         estado='Aceptada', updated_at=now()
   WHERE id = p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_org, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'cotizacion.aceptada_version_fijada','cotizaciones',
    p_cotizacion_id, COALESCE(v_folio,''),
    jsonb_build_object('version_aceptada',v_version,'estado_previo',v_estado_actual));
  RETURN jsonb_build_object('cotizacion_id',p_cotizacion_id,'version_aceptada',v_version);
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_cotizacion_vigente(p_cotizacion_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $function$
DECLARE v_vigencia date;
BEGIN
  SELECT fecha_vigencia INTO v_vigencia FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de convertirla', v_vigencia USING ERRCODE='P0001';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.enforce_cotizacion_vigente(p_cotizacion_id);
  PERFORM public.enforce_revalidacion_sin_cambios(p_cotizacion_id);
  RETURN public.crear_embarque_borrador_core(p_cotizacion_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(
  p_cotizacion_id uuid, p_decision text DEFAULT 'sin_cambios',
  p_tarifa_id_aplicada uuid DEFAULT NULL, p_delta_jsonb jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_embarque_id UUID; v_cot public.cotizaciones%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas') THEN
    RAISE EXCEPTION 'Decisión de tarifa inválida: %', p_decision USING ERRCODE='P0001';
  END IF;
  PERFORM public.enforce_cotizacion_vigente(p_cotizacion_id);
  IF p_decision='sin_cambios' THEN
    PERFORM public.enforce_revalidacion_sin_cambios(p_cotizacion_id);
  END IF;
  v_embarque_id := public.crear_embarque_borrador_core(p_cotizacion_id);
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  UPDATE public.embarques
     SET tarifa_id_original=v_cot.tarifa_id,
         tarifa_id_aplicada=COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
         tarifa_delta_jsonb=p_delta_jsonb,
         tarifa_decision=p_decision,
         tarifa_revalidada_en=now(),
         tarifa_revalidada_por=auth.uid()
   WHERE id=v_embarque_id;
  IF p_decision <> 'sin_cambios' AND v_cot.estado_revalidacion='pendiente_reaprobacion' THEN
    UPDATE public.cotizaciones
       SET estado_revalidacion='reaprobada', revalidacion_resuelta_en=now(), updated_at=now()
     WHERE id=p_cotizacion_id;
  END IF;
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
    SELECT v_cot.organization_id, auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
      'Embarques','tarifa_decision_aplicada', v_embarque_id, v_cot.folio,
      jsonb_build_object('decision',p_decision,
        'tarifa_id_original',v_cot.tarifa_id,
        'tarifa_id_aplicada',COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
        'delta',p_delta_jsonb);
  RETURN v_embarque_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assert_proformas_moneda_soportada(p_proforma_ids uuid[])
RETURNS void LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $function$
DECLARE v_no_sop text;
BEGIN
  SELECT string_agg(DISTINCT m::text, ', ') INTO v_no_sop FROM (
    SELECT cv.moneda::text AS m
      FROM public.conceptos_venta cv
     WHERE cv.proforma_id = ANY(p_proforma_ids)
       AND cv.deleted_at IS NULL
       AND cv.moneda::text NOT IN ('MXN','USD')
    UNION
    SELECT pcc.moneda::text
      FROM public.proforma_conceptos_consolidados pcc
     WHERE pcc.proforma_id = ANY(p_proforma_ids)
       AND pcc.deleted_at IS NULL
       AND pcc.moneda::text NOT IN ('MXN','USD')
  ) x;
  IF v_no_sop IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_MONEDA_NO_SOPORTADA: la conversión sólo soporta MXN/USD hoy; conceptos en % detectados', v_no_sop
      USING ERRCODE='P0001',
            HINT='Elimine o convierta los conceptos en la moneda no soportada antes de facturar.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.embarques_list_extras(p_ids uuid[])
RETURNS TABLE(embarque_id uuid, costos_total bigint, costos_pagados bigint,
              docs_total bigint, docs_pendientes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH permitidos AS (
    SELECT e.id FROM public.embarques e
      JOIN unnest(p_ids) AS u(id) ON u.id = e.id
     WHERE e.organization_id = public.current_user_org_id()
        OR public.has_role(auth.uid(),'super_admin'::app_role)
  )
  SELECT p.id,
    COALESCE(cc.total,0), COALESCE(cc.pagados,0),
    COALESCE(dd.total,0), COALESCE(dd.pendientes,0)
  FROM permitidos p
  LEFT JOIN (
    SELECT c.embarque_id, count(*) AS total,
           count(*) FILTER (WHERE c.estado_liquidacion='Pagado') AS pagados
      FROM public.conceptos_costo c
     WHERE c.embarque_id IN (SELECT id FROM permitidos) AND c.deleted_at IS NULL
     GROUP BY c.embarque_id
  ) cc ON cc.embarque_id=p.id
  LEFT JOIN (
    SELECT d.embarque_id, count(*) AS total,
           count(*) FILTER (WHERE d.archivo IS NULL AND d.estado <> 'No aplica') AS pendientes
      FROM public.documentos_embarque d
     WHERE d.embarque_id IN (SELECT id FROM permitidos) AND d.deleted_at IS NULL
     GROUP BY d.embarque_id
  ) dd ON dd.embarque_id=p.id;
$function$;

DROP POLICY IF EXISTS "Tenant read clientes" ON public.clientes;
CREATE POLICY "Tenant read clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    ((organization_id = public.current_user_org_id())
     OR public.has_role(auth.uid(),'super_admin'::app_role))
    AND NOT public.has_role(auth.uid(),'cliente'::app_role)
  );

-- FIX-R2-15 · unicidad de folio de facturas por org (renombrado con triggers desactivados)
DO $$
DECLARE r record;
BEGIN
  SET LOCAL session_replication_role = replica;
  FOR r IN (
    SELECT id, numero, organization_id,
           row_number() OVER (PARTITION BY organization_id, numero ORDER BY created_at ASC) AS rn
      FROM public.facturas
     WHERE deleted_at IS NULL AND numero IS NOT NULL
  ) LOOP
    IF r.rn > 1 THEN
      UPDATE public.facturas
         SET numero = r.numero || '-DUP-' || substring(r.id::text FROM 1 FOR 8)
       WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.facturas_numero_org_unico;
CREATE UNIQUE INDEX facturas_numero_org_unico
  ON public.facturas (organization_id, numero)
  WHERE deleted_at IS NULL AND numero IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(
  factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                 WHERE nc.factura_id=f.id AND nc.estado='Aplicada' AND nc.deleted_at IS NULL),0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    GREATEST(0, (CURRENT_DATE - b.fecha_vencimiento))::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado
  FROM base b
  LEFT JOIN public.clientes c ON c.id=b.cliente_id
  LEFT JOIN public.embarques e ON e.id=b.embarque_id
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
  ORDER BY GREATEST(0,(CURRENT_DATE-b.fecha_vencimiento)) DESC, b.fecha_vencimiento ASC
  LIMIT 500;
$function$;

CREATE OR REPLACE FUNCTION public.embarque_estado_financiero(_embarque_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $function$
DECLARE
  v_costo_pres numeric; v_costo_capturado numeric; v_costo_pagado numeric;
  v_tiene_proforma boolean; v_tiene_factura boolean; v_factura_pagada boolean;
  v_factura_total numeric; v_factura_cobrado numeric;
  v_semaforo_costo text; v_semaforo_facturacion text;
BEGIN
  SELECT COALESCE(SUM(monto),0) INTO v_costo_pres
    FROM public.conceptos_costo WHERE embarque_id=_embarque_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(total),0) INTO v_costo_capturado
    FROM public.proveedor_facturas
    WHERE embarque_id=_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)),0) INTO v_costo_pagado
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id=pp.proveedor_factura_id
    WHERE pf.embarque_id=_embarque_id AND pf.deleted_at IS NULL AND pp.deleted_at IS NULL;
  SELECT EXISTS(SELECT 1 FROM public.proformas
    WHERE embarque_id=_embarque_id AND deleted_at IS NULL
      AND lower(COALESCE(estado_aprobacion,''))='aprobada') INTO v_tiene_proforma;
  SELECT
    EXISTS(SELECT 1 FROM public.facturas
      WHERE embarque_id=_embarque_id AND deleted_at IS NULL
        AND estado::text NOT IN ('Cancelada','Sustituida')),
    COALESCE(SUM(total) FILTER (WHERE estado::text NOT IN ('Cancelada','Sustituida')),0)
    INTO v_tiene_factura, v_factura_total
  FROM public.facturas WHERE embarque_id=_embarque_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) INTO v_factura_cobrado
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id=pf.factura_id
    WHERE f.embarque_id=_embarque_id AND f.deleted_at IS NULL
      AND pf.deleted_at IS NULL AND f.estado::text NOT IN ('Cancelada','Sustituida');
  v_factura_pagada := v_tiene_factura AND v_factura_cobrado >= v_factura_total AND v_factura_total > 0;
  v_semaforo_costo := CASE
    WHEN v_costo_pres = 0 THEN 'sin_costos'
    WHEN v_costo_capturado = 0 THEN 'pendiente'
    WHEN v_costo_pagado >= v_costo_capturado AND v_costo_capturado > 0 THEN 'pagado'
    WHEN v_costo_capturado > 0 THEN 'capturado'
    ELSE 'pendiente' END;
  v_semaforo_facturacion := CASE
    WHEN v_factura_pagada THEN 'cobrada'
    WHEN v_tiene_factura THEN 'facturada'
    WHEN v_tiene_proforma THEN 'proforma_lista'
    ELSE 'sin_proforma' END;
  RETURN jsonb_build_object(
    'costo', jsonb_build_object(
      'semaforo',v_semaforo_costo,'presupuestado',v_costo_pres,
      'capturado',v_costo_capturado,'pagado',v_costo_pagado),
    'facturacion', jsonb_build_object(
      'semaforo',v_semaforo_facturacion,'tiene_proforma',v_tiene_proforma,
      'tiene_factura',v_tiene_factura,'total_facturado',v_factura_total,
      'cobrado',v_factura_cobrado,'saldo',GREATEST(v_factura_total-v_factura_cobrado,0)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.facturacion_por_emitir()
RETURNS TABLE(proforma_id uuid, numero_proforma text, cliente_id uuid,
              cliente_nombre text, embarque_id uuid, expediente text,
              total numeric, dias_desde_emision integer)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT p.id, p.numero, p.cliente_id, COALESCE(c.nombre, p.cliente_nombre),
    p.embarque_id, e.expediente,
    COALESCE(p.total_mxn, p.total_usd, 0),
    GREATEST(0,(CURRENT_DATE - p.fecha_emision))::int
  FROM public.proformas p
  LEFT JOIN public.clientes c ON c.id=p.cliente_id
  LEFT JOIN public.embarques e ON e.id=p.embarque_id
  WHERE p.deleted_at IS NULL
    AND lower(COALESCE(p.estado_aprobacion,''))='aprobada'
    AND p.factura_id IS NULL
    AND COALESCE(p.estado_proforma,'') <> 'Cancelada'
  ORDER BY p.fecha_emision ASC NULLS LAST
  LIMIT 500;
$function$;
