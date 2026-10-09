-- AUD54 extensión: un centavo real es deuda; nunca se condona por tolerancia.
-- ID LOCAL PROVISIONAL. Sólo funciones y ACL existentes: sin backfill ni cambios
-- de importes, pagos, NC, movimientos bancarios o documentos fiscales históricos.
-- ROUND(numeric, 2) conserva la política monetaria half-away-from-zero.
-- Pagada histórica sólo entra a cobranza si hay un pago vigente documentado
-- y saldo monetario real. La etiqueta almacenada se conserva para revisión.

-- Auditorías 25/54: PUE liquida toda deuda monetaria neta de NC.
-- Sólo cambia la validación de operaciones futuras; no modifica pagos históricos.
CREATE OR REPLACE FUNCTION public._assert_pago_pue_exhibicion_unica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_metodo text;
  v_total numeric;
  v_otros integer;
BEGIN
  SELECT f.metodo_pago, f.total INTO v_metodo, v_total
  FROM public.facturas f WHERE f.id = NEW.factura_id
  FOR UPDATE OF f;
  IF NOT FOUND OR v_metodo IS DISTINCT FROM 'PUE' THEN RETURN NEW; END IF;

  -- Canon: sólo Timbrada/Aplicada, sin soft-delete, convertidas a moneda factura.
  v_total := GREATEST(COALESCE(v_total, 0) - public._nc_aplicadas_moneda_factura(NEW.factura_id), 0);
  -- El bloqueo de factura serializa intentos; el propio pago se excluye en UPDATE.
  SELECT count(*) INTO v_otros FROM public.pagos_factura p
  WHERE p.factura_id = NEW.factura_id AND p.deleted_at IS NULL
    AND COALESCE(p.estado_rep, '') <> 'Cancelado'
    AND p.id IS DISTINCT FROM NEW.id;
  IF v_otros > 0 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_EXHIBICION_UNICA: la factura es PUE y ya tiene un pago registrado; PUE exige liquidar en una sola exhibición. Revisa el pago previo con Cobranza antes de corregirlo.'
      USING ERRCODE = 'P0001';
  END IF;
  -- Valida la deuda monetaria, sin condonar un centavo ni alterar el aplicado exacto.
  IF ROUND(v_total - COALESCE(NEW.monto_aplicado_factura, NEW.monto), 2) > 0 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL: registra el cobro por el saldo neto pendiente (%) en una sola exhibición, considerando las notas de crédito vigentes.', v_total
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._assert_pago_pue_exhibicion_unica() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_pago_pue_exhibicion_unica() TO service_role;


-- Fuente canónica de public.recalcular_estado_factura
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid; v_total numeric; v_pagado numeric; v_saldo numeric;
  v_vencimiento date; v_estado_actual estado_factura; v_nuevo_estado estado_factura;
  v_prev_flag text;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;

  IF v_estado_actual IN ('Cancelada', 'Borrador', 'Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- v13.823.294: `saldo_factura` devuelve 0 cuando la factura ya está 'Pagada'
  -- (atajo para facturas legacy sin pagos capturados). Eso hacía imposible
  -- salir de 'Pagada' al anularse el único pago por REP cancelado.
  -- `saldo_factura_bruto` calcula el saldo real y también excluye pagos con
  -- REP cancelado.
  v_saldo := public.saldo_factura_bruto(v_factura_id);

  -- v13.823.287: los pagos con REP cancelado estan anulados y no cuentan.
  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL
    AND COALESCE(estado_rep, '') <> 'Cancelado';

  IF ROUND(v_saldo, 2) <= 0 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  -- v13.308.3 — Marcar recálculo autorizado para que guard_estado_factura
  -- permita fijar Pagada / Parcialmente pagada / Vencida. Se usa
  -- is_local=true (SET LOCAL) para restringir el efecto a esta
  -- transacción/función.
  v_prev_flag := current_setting('app.recalc_estado_factura', true);
  PERFORM set_config('app.recalc_estado_factura', '1', true);

  UPDATE facturas
  SET estado = v_nuevo_estado, updated_at = now()
  WHERE id = v_factura_id AND estado IS DISTINCT FROM v_nuevo_estado;

  PERFORM set_config('app.recalc_estado_factura', COALESCE(v_prev_flag, ''), true);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.recalcular_estado_factura() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_estado_factura() TO authenticated, service_role;


-- Fuente canónica de public.cartera_pendiente() (Ola 6 · O6-SCHEMA).
-- 1:1 con supabase/migrations/20260813230758_55fd47bb-2d11-4849-9db5-14215387682a.sql.
-- Firma vigente: 16 columnas (factura_id … cancellation_status). NO renombrar columnas de salida (42P13).
-- v13.592.0: se agregó cancellation_status para excluir del cobro en lote las
-- facturas con cancelación en trámite ante el SAT (LC_FACTURA_EN_CANCELACION).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

-- v13.777.9 (FIX3/M1): corre bajo RLS nativo (no SECURITY DEFINER), por eso
-- agrega en línea en vez de llamar a public.nc_aplicadas_en_moneda_factura
-- (oráculo cross-tenant si se expone a authenticated).
-- Ola v17: la cascada de conversión ya NO se copia — usa el helper PURO
-- public.nc_convertida_a_moneda_factura, y el filtro de pagos anulados usa
-- public.pago_rep_anulado (canon único).

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
          AND nc.estado IN ('Timbrada','Aplicada')
      ), 0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND (f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
        OR (f.estado = 'Pagada' AND EXISTS (
          SELECT 1 FROM public.pagos_factura px WHERE px.factura_id = f.id
            AND px.deleted_at IS NULL AND NOT public.pago_rep_anulado(px.estado_rep)
            AND px.monto_aplicado_factura > 0)))
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
  WHERE ROUND(b.total - b.pagado - b.nc_aplicadas, 2) > 0
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO service_role;


-- Fuente canónica de public.cartera_pendiente_total() (N10, v13.823.390).
-- Espejo 1:1 de la migración que la crea. Al modificar: edita ESTE archivo y
-- genera la migración con el mismo cuerpo.
-- Existe porque public.cartera_pendiente() termina en LIMIT 500 y la UI
-- necesita saber si el listado quedó truncado. Corre bajo RLS nativo
-- (SECURITY INVOKER): sólo cuenta lo que el usuario puede leer.

CREATE OR REPLACE FUNCTION public.cartera_pendiente_total()
RETURNS bigint
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT count(*)::bigint
  FROM public.facturas f
  WHERE f.deleted_at IS NULL
    AND (f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
        OR (f.estado = 'Pagada' AND EXISTS (
          SELECT 1 FROM public.pagos_factura px WHERE px.factura_id = f.id
            AND px.deleted_at IS NULL AND NOT public.pago_rep_anulado(px.estado_rep)
            AND px.monto_aplicado_factura > 0)))
    AND ROUND(
      f.total
      - COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                   WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
                     AND NOT public.pago_rep_anulado(pf.estado_rep)), 0)
      - COALESCE((
          SELECT SUM(public.nc_convertida_a_moneda_factura(
                   nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda::text, f.tipo_cambio))
          FROM public.factura_notas_credito nc
          WHERE nc.factura_id = f.id
            AND nc.deleted_at IS NULL
            AND nc.estado IN ('Timbrada','Aplicada')
        ), 0)
    , 2) > 0
$function$;

REVOKE ALL ON FUNCTION public.cartera_pendiente_total() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartera_pendiente_total() FROM anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente_total() TO service_role;


-- AUD54: deuda monetaria visible, sin reescribir estados ni inferir pagos históricos.
CREATE OR REPLACE FUNCTION public.cobranza_listado(
  p_cliente_id uuid DEFAULT NULL,
  p_moneda text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_estatus text DEFAULT NULL,
  p_limit integer DEFAULT 2000
)
RETURNS TABLE(
  id uuid, numero text, cliente_id uuid, cliente_nombre text, expediente text,
  moneda text, total numeric, pagado numeric, notas_credito_aplicadas numeric, saldo numeric,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  estatus_cobranza text, estado_factura text, tipo_cambio numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.org_scope();
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);
BEGIN
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH cartera AS (
    SELECT
      f.id,
      f.numero,
      f.cliente_id,
      f.cliente_nombre,
      f.expediente,
      f.moneda::text AS moneda,
      f.total,
      COALESCE(pg.pagado, 0)::numeric AS pagado,
      COALESCE(nc.notas, 0)::numeric AS notas,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0))::numeric AS saldo,
      f.fecha_emision,
      f.fecha_vencimiento,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento)::integer AS dias_vencido,
      f.estado::text AS estado_factura,
      f.tipo_cambio
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
        AND NOT public.pago_rep_anulado(pf.estado_rep)
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT public._nc_aplicadas_moneda_factura(f.id) AS notas
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND (f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
        OR (f.estado = 'Pagada' AND COALESCE(pg.pagado, 0) > 0
          AND ROUND(f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0), 2) > 0))
      AND f.organization_id = v_org
      AND (p_cliente_id IS NULL OR f.cliente_id = p_cliente_id)
      AND (p_moneda IS NULL OR f.moneda::text = p_moneda)
      AND (
        p_search IS NULL OR p_search = ''
        OR f.numero ILIKE '%' || p_search || '%'
        OR f.cliente_nombre ILIKE '%' || p_search || '%'
      )
  ), clasificada AS (
    SELECT c.*,
      CASE
        WHEN ROUND(c.saldo, 2) <= 0 THEN 'Sin saldo'
        WHEN c.dias_vencido > 0 THEN 'Vencida'
        WHEN c.dias_vencido BETWEEN -7 AND 0 THEN 'Por vencer'
        ELSE 'Vigente'
      END AS estatus
    FROM cartera c
  )
  SELECT
    cl.id, cl.numero, cl.cliente_id, cl.cliente_nombre, cl.expediente,
    cl.moneda, cl.total, cl.pagado, cl.notas, cl.saldo,
    cl.fecha_emision, cl.fecha_vencimiento, cl.dias_vencido,
    cl.estatus, cl.estado_factura, cl.tipo_cambio
  FROM clasificada cl
  WHERE p_estatus IS NULL OR p_estatus = '' OR p_estatus = 'todos'
     OR cl.estatus = p_estatus
  ORDER BY cl.fecha_vencimiento ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranza_listado(uuid, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranza_listado(uuid, text, text, text, integer) TO authenticated, service_role;


-- AUD54: deuda monetaria visible, sin reescribir estados ni inferir pagos históricos.
CREATE OR REPLACE FUNCTION public.cobranza_agregados(
  p_cliente_id uuid DEFAULT NULL,
  p_moneda text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH cartera AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0, f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0)) AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(pf.monto_aplicado_factura) AS pagado
      FROM pagos_factura pf
      WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
        AND NOT public.pago_rep_anulado(pf.estado_rep)
    ) pg ON true
    LEFT JOIN LATERAL (
      SELECT public._nc_aplicadas_moneda_factura(f.id) AS notas
    ) nc ON true
    WHERE f.deleted_at IS NULL
      AND (f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
        OR (f.estado = 'Pagada' AND COALESCE(pg.pagado, 0) > 0
          AND ROUND(f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.notas, 0), 2) > 0))
      AND f.organization_id = public.org_scope()
      AND (p_cliente_id IS NULL OR f.cliente_id = p_cliente_id)
      AND (p_moneda IS NULL OR f.moneda::text = p_moneda)
  )
  SELECT jsonb_build_object(
    'total_mxn',          COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0), 0),
    'total_usd',          COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0), 0),
    'vencido_mxn',        COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0 AND dias_vencido > 0), 0),
    'vencido_usd',        COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0 AND dias_vencido > 0), 0),
    'por_vencer_7d_mxn',  COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'por_vencer_7d_usd',  COALESCE(SUM(ROUND(saldo, 2)) FILTER (WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0 AND dias_vencido BETWEEN -7 AND 0), 0),
    'facturas_vencidas',  COUNT(*) FILTER (WHERE moneda IN ('MXN','USD') AND ROUND(saldo, 2) > 0 AND dias_vencido > 0),
    'facturas_con_saldo', COUNT(*) FILTER (WHERE ROUND(saldo, 2) > 0)
  ) INTO v_result
  FROM cartera;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.cobranza_agregados(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranza_agregados(uuid, text) TO authenticated, service_role;


-- AUD109/111: anticipos históricos sin crédito ficticio y cartera en MXN/USD/EUR.
-- No modifica datos, alcance de organización/portal ni privilegios existentes.
CREATE OR REPLACE FUNCTION public.estado_cuenta_agregados(p_cliente_ids uuid[], p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_result jsonb;
  v_org uuid := public.org_scope();
  v_es_cliente boolean;
BEGIN
  -- M-9 (v14): los usuarios con rol cliente no son miembros de organización
  -- (org_scope() = NULL) y los KPIs salían en $0. El alcance se deriva de los
  -- clientes ligados al usuario.
  IF v_org IS NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = auth.uid()) INTO v_es_cliente;
    IF NOT v_es_cliente THEN
      RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: sin organización activa ni cliente ligado';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(COALESCE(p_cliente_ids, ARRAY[]::uuid[])) AS x(id)
      WHERE x.id NOT IN (SELECT public.current_user_client_ids())
    ) THEN
      RAISE EXCEPTION 'LC_ESTADO_CUENTA_SIN_ACCESO: cliente fuera de tu alcance';
    END IF;
  END IF;
  WITH cartera AS (
    SELECT
      f.id,
      f.moneda::text AS moneda,
      -- Canon de saldo: también reabre facturas Pagada cuyo REP fue cancelado
      -- y convierte NC con las tasas históricas del documento.
      GREATEST(0, public._saldo_factura_calc(f.id)) AS saldo,
      ((now() AT TIME ZONE 'America/Mexico_City')::date - f.fecha_vencimiento) AS dias_vencido
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (v_org IS NULL OR f.organization_id = v_org)
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  ),
  anticipos AS (
    SELECT
      f.moneda::text AS moneda,
      GREATEST(0,
        CASE
          -- Sólo históricos verificables pueden producir un saldo disponible.
          WHEN pf.monto IS NULL OR pf.monto <= 0
            OR pf.monto::text IN ('NaN', 'Infinity', '-Infinity')
            OR pf.monto_aplicado_factura IS NULL OR pf.monto_aplicado_factura < 0
            OR pf.monto_aplicado_factura::text IN ('NaN', 'Infinity', '-Infinity') THEN NULL
          WHEN pf.moneda = f.moneda THEN pf.monto
          WHEN pf.moneda IN ('MXN', 'USD') AND f.moneda IN ('MXN', 'USD')
            AND pf.tipo_cambio > 1
            AND pf.tipo_cambio::text NOT IN ('NaN', 'Infinity', '-Infinity')
          THEN public.convertir_monto_pago_a_factura(
            pf.monto, pf.moneda, pf.tipo_cambio, f.moneda, f.tipo_cambio)
          WHEN (pf.moneda = 'EUR' OR f.moneda = 'EUR')
            AND (pf.moneda = 'MXN' OR (pf.tipo_cambio > 1
              AND pf.tipo_cambio::text NOT IN ('NaN', 'Infinity', '-Infinity')))
            AND (f.moneda = 'MXN' OR (f.tipo_cambio > 1
              AND f.tipo_cambio::text NOT IN ('NaN', 'Infinity', '-Infinity')))
          THEN public.convertir_monto_pago_a_factura(
            pf.monto, pf.moneda, pf.tipo_cambio, f.moneda, f.tipo_cambio)
          ELSE NULL
        END - pf.monto_aplicado_factura
      ) AS no_aplicado
    FROM pagos_factura pf
    JOIN facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND NOT public.pago_rep_anulado(pf.estado_rep)
      AND f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida', 'Pagada')
      AND f.cliente_id = ANY(p_cliente_ids)
      AND (v_org IS NULL OR f.organization_id = v_org)
      AND (p_desde IS NULL OR f.fecha_emision >= p_desde)
      AND (p_hasta IS NULL OR f.fecha_emision <= p_hasta)
  )
  SELECT jsonb_build_object(
    'adeudado_mxn',      COALESCE((SELECT SUM(ROUND(saldo, 2)) FROM cartera WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0), 0),
    'adeudado_usd',      COALESCE((SELECT SUM(ROUND(saldo, 2)) FROM cartera WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0), 0),
    'adeudado_eur',      COALESCE((SELECT SUM(ROUND(saldo, 2)) FROM cartera WHERE moneda = 'EUR' AND ROUND(saldo, 2) > 0), 0),
    'vencido_mxn',       COALESCE((SELECT SUM(ROUND(saldo, 2)) FROM cartera WHERE moneda = 'MXN' AND ROUND(saldo, 2) > 0 AND dias_vencido > 0), 0),
    'vencido_usd',       COALESCE((SELECT SUM(ROUND(saldo, 2)) FROM cartera WHERE moneda = 'USD' AND ROUND(saldo, 2) > 0 AND dias_vencido > 0), 0),
    'vencido_eur',       COALESCE((SELECT SUM(ROUND(saldo, 2)) FROM cartera WHERE moneda = 'EUR' AND ROUND(saldo, 2) > 0 AND dias_vencido > 0), 0),
    'a_favor_mxn',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'MXN'), 0),
    'a_favor_usd',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'USD'), 0),
    'a_favor_eur',       COALESCE((SELECT SUM(no_aplicado) FROM anticipos WHERE moneda = 'EUR'), 0),
    'facturas_vencidas', (SELECT COUNT(*) FROM cartera WHERE ROUND(saldo, 2) > 0 AND dias_vencido > 0),
    'facturas_adeudadas',(SELECT COUNT(*) FROM cartera WHERE ROUND(saldo, 2) > 0)
  ) INTO v_result;
  RETURN v_result;
END;
$_$;
REVOKE ALL ON FUNCTION public.estado_cuenta_agregados(uuid[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_agregados(uuid[], date, date) TO authenticated, service_role;

-- Aging CxC: mismos centavos, conservando exclusiones de cancelación/refacturación.
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
  -- Ola v17: antes restaba ncf.monto EN CRUDO (NC en USD contra facturas MXN).
  nc AS (
    SELECT ncf.factura_id,
           COALESCE(SUM(public.nc_convertida_a_moneda_factura(
             ncf.monto, ncf.moneda::text, ncf.tipo_cambio, f.moneda::text, f.tipo_cambio)), 0) AS aplicado
    FROM public.factura_notas_credito ncf
    JOIN public.facturas f ON f.id = ncf.factura_id AND f.deleted_at IS NULL
    WHERE ncf.estado IN ('Timbrada','Aplicada') AND ncf.deleted_at IS NULL
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
      AND (f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
        OR (f.estado = 'Pagada' AND COALESCE(pg.pagado, 0) > 0))
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
    SUM(ROUND(s.saldo, 2)),
    SUM(CASE WHEN s.dias_vencido <= 0 THEN ROUND(s.saldo, 2) ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 1 AND 30 THEN ROUND(s.saldo, 2) ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN ROUND(s.saldo, 2) ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN ROUND(s.saldo, 2) ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido > 90 THEN ROUND(s.saldo, 2) ELSE 0 END),
    COUNT(*)::int
  FROM saldos s
  WHERE ROUND(s.saldo, 2) > 0
  GROUP BY s.cliente_id, s.moneda
  ORDER BY SUM(ROUND(s.saldo, 2)) DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO service_role;
