-- BUG-2026-08-25: facturas legacy con estado 'Pagada' sin pagos capturados
-- mostraban saldo completo en Estado de cuenta y KPI. Regla única: estado
-- terminal => saldo 0.

CREATE OR REPLACE FUNCTION public.estado_cuenta_agregados(p_cliente_ids uuid[], p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH cartera AS (
    SELECT
      f.id,
      f.moneda::text AS moneda,
      CASE
        WHEN f.estado::text = 'Pagada' THEN 0
        ELSE GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0))
      END AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT SUM(n.monto) AS notas
      FROM factura_notas_credito n
      WHERE n.factura_id = f.id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (f.organization_id = public.org_scope())
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ),
  anticipos AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0,
        pf.monto * CASE
          WHEN pf.moneda = f.moneda THEN 1
          WHEN pf.tipo_cambio IS NOT NULL AND pf.tipo_cambio > 0 THEN pf.tipo_cambio
          ELSE 0
        END - pf.monto_aplicado_factura
      ) AS no_aplicado
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND f.deleted_at IS NULL
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (f.organization_id = public.org_scope())
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  )
  SELECT jsonb_build_object(
    'adeudado_mxn',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0), 0),
    'adeudado_usd',      COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0), 0),
    'vencido_mxn',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'MXN' AND saldo > 0 AND dias_vencido > 0), 0),
    'vencido_usd',       COALESCE((SELECT SUM(saldo) FROM cartera WHERE moneda = 'USD' AND saldo > 0 AND dias_vencido > 0), 0),
    'a_favor_mxn',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'MXN'), 0),
    'a_favor_usd',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'USD'), 0),
    'facturas_vencidas', (SELECT COUNT(*) FROM cartera WHERE saldo > 0 AND dias_vencido > 0),
    'facturas_adeudadas',(SELECT COUNT(*) FROM cartera WHERE saldo > 0)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
  v_moneda text; v_tc numeric;
BEGIN
  SELECT total, estado, organization_id, moneda::text, tipo_cambio
    INTO v_total, v_estado, v_org, v_moneda, v_tc
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  -- BUG-2026-08-25: 'Pagada' también es terminal (facturas legacy sin pagos
  -- capturados generaban adeudo fantasma en el estado de cuenta).
  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador', 'Pagada') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  -- BUG-04 (auditoría 2026-08-18): misma conversión que `cartera_pendiente`.
  -- Si la NC no se puede convertir (falta TC) NO se resta: preferimos un saldo
  -- mayor a marcar como Pagada una factura que no lo está.
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
  WHERE nc.factura_id = p_factura_id AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;

CREATE OR REPLACE FUNCTION public.facturas_cartera_cliente(p_cliente_id uuid, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, organization_id uuid, numero text, serie text, folio text, cliente_id uuid, cliente_nombre text, total numeric, saldo numeric, moneda text, estado text, fecha_emision date, fecha_vencimiento date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_uid uuid := auth.uid();
  v_caller_org uuid;
BEGIN
  SELECT c.organization_id INTO v_org
  FROM public.clientes c WHERE c.id = p_cliente_id AND c.deleted_at IS NULL;
  IF v_org IS NULL THEN RETURN; END IF;

  -- Fail-closed para usuarios finales de otra organización.
  IF v_uid IS NOT NULL
     AND COALESCE(auth.role()::text, '') <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    v_caller_org := public.current_user_org_id();
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT f.id,
         f.organization_id,
         f.numero::text,
         f.serie::text,
         -- BUG-2026-08-25: `facturas.folio` no existe; el folio fiscal es
         -- `folio_fiscal` (la referencia anterior rompía el estado de cuenta
         -- por correo con error 42703).
         f.folio_fiscal::text,
         f.cliente_id,
         f.cliente_nombre::text,
         COALESCE(f.total, 0)::numeric,
         CASE
           WHEN f.estado::text = 'Pagada' THEN 0::numeric
           ELSE (COALESCE(f.total, 0)
             - COALESCE((SELECT SUM(p.monto_aplicado_factura) FROM public.pagos_factura p
                          WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0)
             - COALESCE((SELECT SUM(nc.monto) FROM public.factura_notas_credito nc
                          WHERE nc.factura_id = f.id AND nc.deleted_at IS NULL
                            AND nc.estado = 'Aplicada'), 0))::numeric
         END AS saldo,
         f.moneda::text,
         f.estado::text,
         f.fecha_emision,
         f.fecha_vencimiento
  FROM public.facturas f
  WHERE f.cliente_id = p_cliente_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Borrador', 'Cancelada', 'Sustituida')
    AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
    AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ORDER BY f.fecha_emision;
END;
$function$;