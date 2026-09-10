-- =====================================================================
-- Ola v17 · Fuente única de verdad del saldo de factura
-- =====================================================================

-- 1) Helper PURO: convierte una NC a la moneda de la factura.
--    IMMUTABLE y sin acceso a tablas => se puede otorgar a authenticated sin
--    convertirlo en un oráculo cross-tenant (motivo por el que la cascada
--    estaba copiada en 4 funciones).
CREATE OR REPLACE FUNCTION public.nc_convertida_a_moneda_factura(
  p_monto numeric,
  p_moneda_nc text,
  p_tc_nc numeric,
  p_moneda_factura text,
  p_tc_factura numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_monto IS NULL OR p_moneda_factura IS NULL THEN 0
    WHEN p_moneda_nc = p_moneda_factura THEN p_monto
    WHEN p_moneda_factura = 'MXN' AND p_moneda_nc <> 'MXN' AND COALESCE(p_tc_nc, 0) > 1
      THEN p_monto * p_tc_nc
    WHEN p_moneda_factura <> 'MXN' AND p_moneda_nc = 'MXN' AND COALESCE(p_tc_factura, 0) > 1
      THEN p_monto / p_tc_factura
    WHEN p_moneda_factura <> 'MXN' AND p_moneda_nc <> 'MXN'
         AND p_moneda_factura <> p_moneda_nc
         AND COALESCE(p_tc_nc, 0) > 1 AND COALESCE(p_tc_factura, 0) > 1
      THEN (p_monto * p_tc_nc) / p_tc_factura
    ELSE 0
  END
$function$;

REVOKE ALL ON FUNCTION public.nc_convertida_a_moneda_factura(numeric, text, numeric, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nc_convertida_a_moneda_factura(numeric, text, numeric, text, numeric) TO authenticated, service_role;

-- 2) Helper PURO: un pago cuyo REP fue cancelado ante el SAT está ANULADO.
CREATE OR REPLACE FUNCTION public.pago_rep_anulado(p_estado_rep text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT lower(btrim(COALESCE(p_estado_rep, ''))) = 'cancelado'
$function$;

REVOKE ALL ON FUNCTION public.pago_rep_anulado(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pago_rep_anulado(text) TO authenticated, service_role;

-- 3) Cálculo CANÓNICO del saldo (sin ACL: uso interno de las funciones
--    SECURITY DEFINER que sí validan tenencia).
--    Terminal (saldo 0) SÓLO Cancelada/Sustituida. 'Pagada' ya NO es terminal:
--    ese atajo creaba la circularidad saldo -> estado -> saldo que impedía
--    sacar de 'Pagada' una factura cuyo único pago quedó anulado.
CREATE OR REPLACE FUNCTION public._saldo_factura_calc(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_moneda text; v_tc numeric; v_estado estado_factura;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT f.total, f.moneda::text, f.tipo_cambio, f.estado
    INTO v_total, v_moneda, v_tc, v_estado
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_estado IN ('Cancelada', 'Sustituida') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura p
  WHERE p.factura_id = p_factura_id AND p.deleted_at IS NULL
    AND NOT public.pago_rep_anulado(p.estado_rep);

  SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
           nc.monto, nc.moneda::text, nc.tipo_cambio, v_moneda, v_tc)), 0)
    INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - COALESCE(v_pagos, 0) - COALESCE(v_ncs, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public._saldo_factura_calc(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_factura_calc(uuid) TO service_role;

-- 4) saldo_factura: envoltura delgada = ACL (org + portal) + cálculo canónico.
CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_cliente uuid; v_uid uuid; v_caller_org uuid;
BEGIN
  SELECT f.organization_id, f.cliente_id INTO v_org, v_cliente
  FROM public.facturas f WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      -- Portal: el usuario cliente sí puede consultar el saldo de SU factura.
      IF v_cliente IS NULL
         OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  RETURN public._saldo_factura_calc(p_factura_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;

-- 5) saldo_factura_bruto: mismo cálculo, ACL sólo por organización.
--    Se conserva por compatibilidad (lo usa recalcular_estado_factura).
CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_uid uuid; v_caller_org uuid;
BEGIN
  SELECT f.organization_id INTO v_org
  FROM public.facturas f WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
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

  RETURN public._saldo_factura_calc(p_factura_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura_bruto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura_bruto(uuid) TO authenticated, service_role;

-- 6) cartera_pendiente: corre bajo RLS nativo (no definer), por eso agrega en
--    línea, pero ya sin copiar la cascada de conversión.
CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text, cancellation_status text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL
                   AND NOT public.pago_rep_anulado(pf.estado_rep)),0) AS pagado,
      COALESCE((
        SELECT SUM(public.nc_convertida_a_moneda_factura(
                 nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda::text, f.tipo_cambio))
        FROM public.factura_notas_credito nc
        WHERE nc.factura_id = f.id
          AND nc.deleted_at IS NULL
          AND nc.estado = 'Aplicada'
      ), 0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    ((now() AT TIME ZONE 'America/Mexico_City')::date - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado, b.cancellation_status
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id AND e.deleted_at IS NULL
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO authenticated, service_role;

-- 7) portal_factura_resumen_saldo: el desglose y el saldo salen de la MISMA
--    lectura (antes el saldo venía de otra función y podía no cuadrar).
CREATE OR REPLACE FUNCTION public.portal_factura_resumen_saldo(p_factura_id uuid)
RETURNS TABLE(total numeric, pagado numeric, notas_credito numeric, saldo numeric,
              num_pagos integer, num_notas integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid; v_moneda text; v_tc numeric; v_total numeric; v_estado estado_factura;
BEGIN
  SELECT f.cliente_id, f.moneda::text, f.tipo_cambio, f.total, f.estado
    INTO v_cliente, v_moneda, v_tc, v_total, v_estado
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_cliente IS NULL
     OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH p AS (
    SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) AS monto, COUNT(*)::int AS n
    FROM public.pagos_factura pf
    WHERE pf.factura_id = p_factura_id AND pf.deleted_at IS NULL
      AND NOT public.pago_rep_anulado(pf.estado_rep)
  ), nc AS (
    SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
             n.monto, n.moneda::text, n.tipo_cambio, v_moneda, v_tc)), 0) AS monto,
           COUNT(*)::int AS n
    FROM public.factura_notas_credito n
    WHERE n.factura_id = p_factura_id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
  )
  SELECT COALESCE(v_total, 0), p.monto, nc.monto,
         CASE WHEN v_estado IN ('Cancelada','Sustituida') THEN 0
              ELSE COALESCE(v_total, 0) - p.monto - nc.monto END,
         p.n, nc.n
  FROM p, nc;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_factura_resumen_saldo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_factura_resumen_saldo(uuid) TO authenticated, service_role;

-- 8) cxc_aging_clientes: excluía pagos anulados pero restaba NC SIN convertir
--    de moneda (NC en USD contra facturas MXN).
CREATE OR REPLACE FUNCTION public.cxc_aging_clientes(p_org uuid DEFAULT NULL::uuid, p_fecha date DEFAULT CURRENT_DATE)
 RETURNS TABLE(cliente_id uuid, cliente_nombre text, moneda text, saldo_total numeric, vigente numeric, d_1_30 numeric, d_31_60 numeric, d_61_90 numeric, mas_90 numeric, num_facturas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_org uuid;
  v_is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF v_caller_org IS NULL AND NOT v_is_super THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organización activa' USING ERRCODE='42501';
  END IF;
  IF v_is_super THEN
    IF p_org IS NULL THEN
      RAISE EXCEPTION 'LC_ORG_REQUERIDA: selecciona una organización para ver este reporte' USING ERRCODE='42501';
    END IF;
    v_org := p_org;
  ELSIF p_org IS NOT NULL AND p_org IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes consultar el aging de otra organización' USING ERRCODE='42501';
  ELSE
    v_org := v_caller_org;
  END IF;

  RETURN QUERY
  WITH pagado AS (
    SELECT pf.factura_id, COALESCE(SUM(pf.monto_aplicado_factura), 0) AS pagado
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id AND f.deleted_at IS NULL
    WHERE pf.deleted_at IS NULL
      AND NOT public.pago_rep_anulado(pf.estado_rep)
      AND (v_org IS NULL OR f.organization_id = v_org)
    GROUP BY pf.factura_id
  ),
  nc AS (
    SELECT ncf.factura_id,
           COALESCE(SUM(public.nc_convertida_a_moneda_factura(
             ncf.monto, ncf.moneda::text, ncf.tipo_cambio, f.moneda::text, f.tipo_cambio)), 0) AS aplicado
    FROM public.factura_notas_credito ncf
    JOIN public.facturas f ON f.id = ncf.factura_id AND f.deleted_at IS NULL
    WHERE ncf.estado = 'Aplicada' AND ncf.deleted_at IS NULL
      AND (v_org IS NULL OR f.organization_id = v_org)
    GROUP BY ncf.factura_id
  ),
  saldos AS (
    SELECT
      f.cliente_id,
      f.cliente_nombre,
      UPPER(COALESCE(f.moneda::text, 'MXN')) AS moneda,
      f.id AS factura_id,
      GREATEST(f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.aplicado, 0), 0) AS saldo,
      (p_fecha - COALESCE(f.fecha_vencimiento, f.fecha_emision))::int AS dias_vencido
    FROM public.facturas f
    LEFT JOIN pagado pg ON pg.factura_id = f.id
    LEFT JOIN nc ON nc.factura_id = f.id
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND COALESCE(f.cancellation_status, 'none') NOT IN ('pending','verifying','accepted')
      AND f.sustituida_por IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.refacturaciones r
        WHERE r.factura_original_id = f.id AND r.estado = 'completado'
      )
      AND (v_org IS NULL OR f.organization_id = v_org)
  )
  SELECT
    s.cliente_id,
    MAX(s.cliente_nombre),
    s.moneda,
    SUM(s.saldo),
    SUM(CASE WHEN s.dias_vencido <= 0 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 1 AND 30 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido > 90 THEN s.saldo ELSE 0 END),
    COUNT(*)::int
  FROM saldos s
  WHERE s.saldo > 0.005
  GROUP BY s.cliente_id, s.moneda
  ORDER BY SUM(s.saldo) DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO authenticated, service_role;
