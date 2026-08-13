-- Ola 12 · Sprint 10 (P1 multi-moneda y fiscal SAT)
-- R3P-01/R3P-06/R3FE-01: se elimina la suma de divisas distintas como si
-- fueran la misma unidad en el estado de cuenta y en los KPIs de salud del
-- proveedor. Nuevas funciones canónicas de conversión que devuelven NULL
-- cuando falta el tipo de cambio, en vez de asumir 1:1.

CREATE OR REPLACE FUNCTION public.a_mxn(
  p_monto numeric,
  p_moneda text,
  p_usd_mxn numeric,
  p_eur_mxn numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_monto IS NULL THEN NULL
    WHEN p_moneda = 'MXN' THEN p_monto
    WHEN p_moneda = 'USD' AND COALESCE(p_usd_mxn, 0) > 0 THEN round(p_monto * p_usd_mxn, 4)
    WHEN p_moneda = 'EUR' AND COALESCE(p_eur_mxn, 0) > 0 THEN round(p_monto * p_eur_mxn, 4)
    ELSE NULL
  END
$function$;

CREATE OR REPLACE FUNCTION public.monto_pago_en_moneda_factura(
  p_monto numeric,
  p_moneda_pago text,
  p_tc_pago numeric,
  p_moneda_factura text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_factura THEN RETURN p_monto; END IF;
  IF COALESCE(p_tc_pago, 0) <= 0 THEN RETURN NULL; END IF;
  IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / p_tc_pago, 4); END IF;
  IF p_moneda_factura = 'MXN' THEN RETURN round(p_monto * p_tc_pago, 4); END IF;
  -- Cruce USD<->EUR: pagos_proveedor no almacena TC cruzado; se excluye.
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.saldo_factura_proveedor(p_factura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_f public.proveedor_facturas;
  v_pagado numeric;
  v_nc numeric;
  v_incompleto boolean;
BEGIN
  SELECT * INTO v_f
  FROM public.proveedor_facturas
  WHERE id = p_factura_id AND deleted_at IS NULL;

  IF v_f.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, v_f.moneda::text)), 0),
         BOOL_OR(pp.moneda::text <> v_f.moneda::text AND COALESCE(pp.tipo_cambio_usd, 0) <= 0)
    INTO v_pagado, v_incompleto
  FROM public.pagos_proveedor pp
  WHERE pp.proveedor_factura_id = p_factura_id
    AND pp.deleted_at IS NULL;

  SELECT COALESCE(SUM(nc.monto), 0) INTO v_nc
  FROM public.proveedor_notas_credito nc
  WHERE nc.proveedor_factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  RETURN jsonb_build_object(
    'factura_id', p_factura_id,
    'moneda', v_f.moneda::text,
    'total', COALESCE(v_f.total, 0),
    'pagado', ROUND(v_pagado, 2),
    'nc_aplicada', ROUND(v_nc, 2),
    'saldo', ROUND(GREATEST(COALESCE(v_f.total, 0) - v_pagado - v_nc, 0), 2),
    'flujo_incompleto', COALESCE(v_incompleto, false)
  );
END;
$function$;

-- ============================================================
-- proveedor_estado_cuenta — acumulativa sobre Ola 12 · Sprint 07
-- (R3BD-05 + R3BD-06) + R3P-01 (pagos convertidos).
-- ============================================================
CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta(p_proveedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_partidas jsonb;
  v_huerfanas jsonb;
  v_usd numeric;
  v_eur numeric;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  WITH cc AS (
    SELECT c.id, c.concepto, c.monto, c.moneda::text AS moneda,
           c.estado_liquidacion::text AS estado_liquidacion,
           c.fecha_vencimiento, c.created_at,
           e.id AS embarque_id, e.expediente, e.cliente_nombre
    FROM public.conceptos_costo c
    LEFT JOIN public.embarques e ON e.id = c.embarque_id
    WHERE c.proveedor_id = p_proveedor_id
      AND c.organization_id = v_oid
      AND c.deleted_at IS NULL
  ),
  pfc_conv AS (
    SELECT pfc.concepto_costo_id,
           pfc.monto,
           pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.estado::text AS estado, pf.estado_aprobacion::text AS estado_aprobacion,
           pf.fecha_emision, pf.fecha_vencimiento, pf.moneda::text AS moneda,
           pf.total,
           cc2.moneda::text AS moneda_concepto,
           CASE pf.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN COALESCE(NULLIF(pf.tipo_cambio_usd, 0), v_usd)
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_factura,
           CASE cc2.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN v_usd
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_concepto
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    JOIN public.conceptos_costo cc2
      ON cc2.id = pfc.concepto_costo_id AND cc2.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  fact AS (
    SELECT c.concepto_costo_id,
           SUM(CASE
                 WHEN c.moneda = c.moneda_concepto THEN c.monto
                 WHEN c.tc_factura IS NOT NULL AND c.tc_concepto IS NOT NULL
                      AND c.tc_concepto > 0
                   THEN c.monto * c.tc_factura / c.tc_concepto
                 ELSE NULL
               END) AS monto_facturado,
           COALESCE(bool_or(
             c.moneda <> c.moneda_concepto
             AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
           ), false) AS moneda_mixta_sin_tc,
           SUM(CASE
                 WHEN c.moneda <> c.moneda_concepto
                      AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
                 THEN c.monto
               END) AS monto_sin_tc,
           jsonb_agg(DISTINCT jsonb_build_object(
             'factura_id', c.factura_id,
             'folio_interno', c.folio_interno,
             'folio_proveedor', c.folio_proveedor,
             'estado', c.estado,
             'estado_aprobacion', c.estado_aprobacion,
             'fecha_emision', c.fecha_emision,
             'fecha_vencimiento', c.fecha_vencimiento,
             'moneda', c.moneda,
             'total', c.total
           )) AS facturas
    FROM pfc_conv c
    GROUP BY c.concepto_costo_id
  ),
  pagos_por_factura AS (
    -- Ola 12 · R3P-01: pagos convertidos a la moneda de la factura con el TC
    -- del pago; los cross-moneda sin TC quedan fuera (SUM ignora NULL).
    SELECT pp.proveedor_factura_id,
           SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) AS pagado
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND pp.deleted_at IS NULL
    GROUP BY pp.proveedor_factura_id
  ),
  pag AS (
    SELECT pfc.concepto_costo_id,
           SUM(
             COALESCE(ppf.pagado, 0)
             * CASE
                 WHEN COALESCE(pf.subtotal, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) / pf.subtotal, 1)
                 WHEN COALESCE(pf.total, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) / pf.total, 1)
                 ELSE 0
               END
           ) AS pagado_factura
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    LEFT JOIN pagos_por_factura ppf ON ppf.proveedor_factura_id = pf.id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
    GROUP BY pfc.concepto_costo_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_partidas
  FROM (
    SELECT cc.id AS concepto_costo_id,
           cc.embarque_id, COALESCE(cc.expediente,'') AS expediente,
           COALESCE(cc.cliente_nombre,'') AS cliente_nombre,
           cc.concepto, cc.monto AS comprometido, cc.moneda,
           cc.estado_liquidacion, cc.fecha_vencimiento, cc.created_at,
           COALESCE(f.monto_facturado, 0) AS facturado,
           COALESCE(f.facturas, '[]'::jsonb) AS facturas,
           ROUND(COALESCE(p.pagado_factura, 0), 2) AS pagado,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado'
               THEN 0::numeric
             ELSE GREATEST(cc.monto - COALESCE(f.monto_facturado,0), 0)
           END AS por_facturar,
           COALESCE(f.moneda_mixta_sin_tc, false) AS moneda_mixta_sin_tc,
           ROUND(COALESCE(f.monto_sin_tc, 0), 2) AS monto_sin_tc,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             WHEN COALESCE(f.moneda_mixta_sin_tc, false) THEN 'Moneda mixta'
             WHEN COALESCE(f.monto_facturado,0) <= 0 THEN 'Por facturar'
             WHEN COALESCE(f.monto_facturado,0) > cc.monto * 1.01 THEN 'Sobrefacturado'
             WHEN COALESCE(f.monto_facturado,0) < cc.monto * 0.99 THEN 'Facturado parcial'
             WHEN cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             ELSE 'Facturado'
           END AS estado_conciliacion
    FROM cc
    LEFT JOIN fact f ON f.concepto_costo_id = cc.id
    LEFT JOIN pag p ON p.concepto_costo_id = cc.id
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.fecha_emision DESC), '[]'::jsonb)
  INTO v_huerfanas
  FROM (
    SELECT pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.fecha_emision, pf.moneda::text AS moneda,
           SUM(pfc.monto) AS monto_sin_vincular,
           COUNT(*) AS partidas
    FROM public.proveedor_facturas pf
    JOIN public.proveedor_facturas_conceptos pfc ON pfc.proveedor_factura_id = pf.id
    LEFT JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND cc.id IS NULL
    GROUP BY pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_emision, pf.moneda
  ) h;

  RETURN jsonb_build_object(
    'partidas', v_partidas,
    'facturas_huerfanas', v_huerfanas
  );
END;
$function$;

-- ============================================================
-- proveedor_estado_cuenta_movimientos — acumulativa sobre Ola 12 ·
-- Sprint 09 (R3P-07 + R3P-08) + R3P-06 (pagos cross-moneda convertidos a
-- la moneda de la factura; sin TC se excluyen y se etiquetan).
-- Conserva R3FE-04 (paginación), R3P-09 (saldos globales), R3P-10
-- (fecha CDMX), R3BD-04 ('Pagada' => saldo 0) y R3FE-03 (saldo_apertura).
-- ============================================================
CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta_movimientos(
  p_proveedor_id uuid,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL,
  p_limite integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_todos jsonb;
  v_movs_full jsonb;
  v_movs jsonb;
  v_apertura jsonb;
  v_aging jsonb;
  v_saldos jsonb;
  v_total integer;
  v_offset_efectivo integer;
  v_desde date := COALESCE(p_desde, '1900-01-01'::date);
  v_hasta date := COALESCE(p_hasta, '2999-12-31'::date);
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 5000);
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_emision,
           pf.fecha_vencimiento, pf.moneda::text AS moneda, pf.total,
           pf.estado::text AS estado, pf.embarque_id, e.expediente
    FROM public.proveedor_facturas pf
    LEFT JOIN public.embarques e ON e.id = pf.embarque_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  notas AS (
    -- R3P-08: sólo NC aplicadas descuentan el estado de cuenta (regla única).
    SELECT nc.id, nc.folio_nc, nc.fecha, nc.monto, nc.moneda::text AS moneda,
           nc.proveedor_factura_id, f.folio_interno, f.expediente, f.embarque_id
    FROM public.proveedor_notas_credito nc
    JOIN facturas f ON f.id = nc.proveedor_factura_id
    WHERE nc.organization_id = v_oid
      AND nc.deleted_at IS NULL
      AND nc.estado = 'Aplicada'
  ),
  pagos AS (
    -- Ola 12 · R3P-06: el abono se convierte a la moneda de la factura; NULL = sin TC.
    SELECT pp.id, pp.fecha_pago,
           pp.monto AS monto_pago, pp.moneda::text AS moneda_pago,
           public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, f.moneda) AS monto_factura,
           f.moneda AS moneda_factura,
           pp.referencia, pp.metodo_pago, pp.es_anticipo_aplicado,
           pp.proveedor_factura_id, f.folio_interno, f.expediente, f.embarque_id
    FROM public.pagos_proveedor pp
    JOIN facturas f ON f.id = pp.proveedor_factura_id
    WHERE pp.organization_id = v_oid
      AND pp.deleted_at IS NULL
  ),
  anticipos AS (
    SELECT a.id, a.fecha_anticipo, a.monto, a.moneda::text AS moneda,
           a.referencia, a.metodo_pago, a.embarque_id, e.expediente
    FROM public.anticipos_proveedor a
    LEFT JOIN public.embarques e ON e.id = a.embarque_id
    WHERE a.proveedor_id = p_proveedor_id
      AND a.organization_id = v_oid
      AND a.deleted_at IS NULL
      AND a.estado <> 'Cancelado'
  ),
  movs AS (
    SELECT f.fecha_emision AS fecha, 'Factura'::text AS tipo, f.id AS ref_id,
           COALESCE(f.folio_interno, f.folio_proveedor, 'Sin folio') AS folio,
           f.folio_proveedor AS referencia, COALESCE(f.expediente, '') AS expediente,
           f.embarque_id, f.moneda, COALESCE(f.total, 0) AS cargo, 0::numeric AS abono,
           f.estado AS detalle
    FROM facturas f
    UNION ALL
    SELECT n.fecha, 'Nota de crédito', n.id,
           COALESCE(n.folio_nc, 'NC'), n.folio_interno, COALESCE(n.expediente, ''),
           n.embarque_id, n.moneda, 0::numeric, COALESCE(n.monto, 0), NULL::text
    FROM notas n
    UNION ALL
    SELECT p.fecha_pago,
           CASE WHEN p.es_anticipo_aplicado THEN 'Anticipo aplicado' ELSE 'Pago' END,
           p.id, COALESCE(p.folio_interno, 'Pago'), p.referencia,
           COALESCE(p.expediente, ''), p.embarque_id,
           -- R3P-06: el abono se expresa en la moneda del cargo (factura).
           p.moneda_factura AS moneda,
           0::numeric,
           -- R3P-07: la aplicación de un anticipo es informativa (0/0); el
           -- abono ya se contó en la fila "Anticipo" al entregarlo.
           CASE WHEN p.es_anticipo_aplicado THEN 0::numeric ELSE COALESCE(p.monto_factura, 0) END,
           CASE
             WHEN p.es_anticipo_aplicado
               THEN COALESCE(p.metodo_pago, '') || ' · anticipo ya contado al entregarse'
             WHEN p.moneda_pago <> p.moneda_factura AND p.monto_factura IS NULL
               THEN COALESCE(p.metodo_pago, '') || ' · pagado en ' || p.moneda_pago || ' SIN TC (excluido del saldo)'
             WHEN p.moneda_pago <> p.moneda_factura
               THEN COALESCE(p.metodo_pago, '') || ' · pagado en ' || p.moneda_pago
             ELSE p.metodo_pago
           END
    FROM pagos p
    UNION ALL
    SELECT a.fecha_anticipo, 'Anticipo', a.id, 'Anticipo', a.referencia,
           COALESCE(a.expediente, ''), a.embarque_id, a.moneda,
           -- R3P-07: el anticipo entregado ES un abono (dinero al proveedor).
           0::numeric, COALESCE(a.monto, 0), a.metodo_pago
    FROM anticipos a
  )
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.fecha, m.tipo, m.folio), '[]'::jsonb)
  INTO v_todos
  FROM movs m;

  SELECT COALESCE(jsonb_agg(m ORDER BY m->>'fecha', m->>'tipo', m->>'folio'), '[]'::jsonb)
  INTO v_movs_full
  FROM jsonb_array_elements(v_todos) m
  WHERE (m->>'fecha')::date BETWEEN v_desde AND v_hasta;

  v_total := COALESCE(jsonb_array_length(v_movs_full), 0);
  v_offset_efectivo := GREATEST(v_total - v_limite, 0) + GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COALESCE(jsonb_agg(pag.value ORDER BY pag.ord), '[]'::jsonb)
  INTO v_movs
  FROM (
    SELECT t.value, t.ord
    FROM jsonb_array_elements(v_movs_full) WITH ORDINALITY AS t(value, ord)
    ORDER BY t.ord
    OFFSET v_offset_efectivo
    LIMIT v_limite
  ) pag;

  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.moneda), '[]'::jsonb)
  INTO v_apertura
  FROM (
    SELECT m->>'moneda' AS moneda,
           SUM((m->>'cargo')::numeric) - SUM((m->>'abono')::numeric) AS saldo
    FROM jsonb_array_elements(v_todos) m
    WHERE (m->>'fecha')::date < v_desde
      AND m->>'moneda' IS NOT NULL
    GROUP BY m->>'moneda'
  ) a;

  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_vencimiento,
           pf.moneda::text AS moneda, COALESCE(pf.total, 0) AS total,
           pf.estado::text AS estado
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  saldo_factura AS (
    SELECT f.id, f.moneda, f.fecha_vencimiento,
           -- Ola 12 · R3BD-04: factura marcada 'Pagada' (legacy, sin pagos
           -- capturados) => saldo 0. Misma regla que proveedor_inteligencia.
           CASE WHEN f.estado = 'Pagada' THEN 0::numeric
                ELSE f.total
                  -- R3P-06: pagos convertidos a la moneda de la factura.
                  - COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, f.moneda))
                              FROM public.pagos_proveedor pp
                              WHERE pp.proveedor_factura_id = f.id AND pp.deleted_at IS NULL), 0)
                  -- R3P-08: sólo NC 'Aplicada' (regla única del módulo).
                  - COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
                              WHERE nc.proveedor_factura_id = f.id AND nc.deleted_at IS NULL
                                AND nc.estado = 'Aplicada'), 0)
           END AS saldo
    FROM facturas f
  ),
  clasificado AS (
    SELECT s.moneda, s.saldo,
           CASE
             WHEN s.fecha_vencimiento IS NULL OR s.fecha_vencimiento >= v_hoy_mx THEN 'Vigente'
             WHEN v_hoy_mx - s.fecha_vencimiento <= 30 THEN '1-30'
             WHEN v_hoy_mx - s.fecha_vencimiento <= 60 THEN '31-60'
             WHEN v_hoy_mx - s.fecha_vencimiento <= 90 THEN '61-90'
             ELSE '90+'
           END AS bucket
    FROM saldo_factura s
    WHERE s.saldo > 0.01
  )
  SELECT COALESCE(jsonb_agg(row_to_json(a) ORDER BY a.moneda, a.bucket), '[]'::jsonb)
  INTO v_aging
  FROM (
    SELECT c.moneda, c.bucket, SUM(c.saldo) AS saldo, COUNT(*) AS conteo
    FROM clasificado c
    GROUP BY c.moneda, c.bucket
  ) a;

  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.moneda), '[]'::jsonb)
  INTO v_saldos
  FROM (
    SELECT m->>'moneda' AS moneda,
           SUM((m->>'cargo')::numeric) AS cargos,
           SUM((m->>'abono')::numeric) AS abonos,
           SUM((m->>'cargo')::numeric) - SUM((m->>'abono')::numeric) AS saldo
    FROM jsonb_array_elements(v_todos) m
    WHERE m->>'moneda' IS NOT NULL
    GROUP BY m->>'moneda'
  ) s;

  RETURN jsonb_build_object(
    'movimientos', v_movs,
    'saldo_apertura', v_apertura,
    'aging', v_aging,
    'saldos', v_saldos,
    'total_movimientos', v_total,
    'hay_mas', v_offset_efectivo > 0 OR (v_offset_efectivo + v_limite) < v_total
  );
END;
$function$;

-- ============================================================
-- proveedor_salud — Ola 12 · R3FE-01: KPIs valuados a MXN con TC DOF.
-- ============================================================
CREATE OR REPLACE FUNCTION public.proveedor_salud(p_proveedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_usd numeric;
  v_eur numeric;
  v_faltante boolean := false;
  v_facturas_12m integer;
  v_monto_12m numeric;
  v_saldo numeric;
  v_dias_promedio numeric;
  v_pct_a_tiempo numeric;
  v_nc_count integer;
  v_nc_monto numeric;
  v_embarques_activos integer;
  v_mensual jsonb;
BEGIN
  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  SELECT COUNT(*),
         COALESCE(SUM(public.a_mxn(total, moneda::text, v_usd, v_eur)), 0),
         BOOL_OR(moneda::text <> 'MXN' AND public.a_mxn(total, moneda::text, v_usd, v_eur) IS NULL)
  INTO v_facturas_12m, v_monto_12m, v_faltante
  FROM public.proveedor_facturas
  WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
    AND deleted_at IS NULL AND estado <> 'Cancelada'
    AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months');

  -- Saldo: el saldo de cada factura se calcula en SU moneda (R3P-01) y luego
  -- se valúa a MXN; así no se mezclan divisas en la resta.
  WITH saldos AS (
    SELECT pf.moneda::text AS moneda,
           GREATEST(
             COALESCE(pf.total, 0)
             - COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text))
                         FROM public.pagos_proveedor pp
                         WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0)
             - COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
                         WHERE nc.proveedor_factura_id = pf.id AND nc.deleted_at IS NULL
                           AND nc.estado = 'Aplicada'), 0)
           , 0) AS saldo
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
  )
  SELECT COALESCE(SUM(public.a_mxn(saldo, moneda, v_usd, v_eur)), 0),
         v_faltante OR COALESCE(BOOL_OR(moneda <> 'MXN' AND public.a_mxn(saldo, moneda, v_usd, v_eur) IS NULL), false)
  INTO v_saldo, v_faltante
  FROM saldos;

  WITH pagos_x_fact AS (
    SELECT pf.id, pf.fecha_emision, MAX(pp.fecha_pago) AS fecha_ultimo_pago,
           pf.fecha_vencimiento,
           SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) AS pagado,
           pf.total
    FROM public.proveedor_facturas pf
    JOIN public.pagos_proveedor pp ON pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
    GROUP BY pf.id, pf.fecha_emision, pf.fecha_vencimiento, pf.total
    HAVING SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) >= pf.total - 0.01
  )
  SELECT
    AVG(fecha_ultimo_pago - fecha_emision)::numeric,
    CASE WHEN COUNT(*)=0 THEN NULL
         ELSE 100.0 * SUM(CASE WHEN fecha_vencimiento IS NULL OR fecha_ultimo_pago <= fecha_vencimiento THEN 1 ELSE 0 END) / COUNT(*) END
  INTO v_dias_promedio, v_pct_a_tiempo FROM pagos_x_fact;

  SELECT COUNT(*),
         COALESCE(SUM(public.a_mxn(nc.monto, nc.moneda::text, v_usd, v_eur)), 0),
         v_faltante OR COALESCE(BOOL_OR(nc.moneda::text <> 'MXN' AND public.a_mxn(nc.monto, nc.moneda::text, v_usd, v_eur) IS NULL), false)
  INTO v_nc_count, v_nc_monto, v_faltante
  FROM public.proveedor_notas_credito nc
  JOIN public.proveedor_facturas pf ON pf.id = nc.proveedor_factura_id
  WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
    AND nc.estado <> 'Cancelada';

  SELECT COUNT(DISTINCT e.id) INTO v_embarques_activos
  FROM public.embarques e
  WHERE e.organization_id = v_oid
    AND (e.naviera_id = p_proveedor_id OR e.agente_id = p_proveedor_id)
    AND COALESCE(e.estado::text,'') NOT IN ('Entregado','Cancelado','Cerrado');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY mes), '[]'::jsonb)
  INTO v_mensual
  FROM (
    SELECT to_char(date_trunc('month', fecha_emision), 'YYYY-MM') AS mes,
           SUM(public.a_mxn(total, moneda::text, v_usd, v_eur)) AS monto,
           COUNT(*) AS facturas
    FROM public.proveedor_facturas
    WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
      AND deleted_at IS NULL AND estado <> 'Cancelada'
      AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months')
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'facturas_12m', v_facturas_12m,
    'monto_12m', ROUND(COALESCE(v_monto_12m, 0), 2),
    'saldo_actual', ROUND(COALESCE(v_saldo, 0), 2),
    'dias_promedio_pago', v_dias_promedio,
    'pct_pagadas_a_tiempo', v_pct_a_tiempo,
    'notas_credito_count', v_nc_count,
    'notas_credito_monto', ROUND(COALESCE(v_nc_monto, 0), 2),
    'embarques_activos', v_embarques_activos,
    'mensual', v_mensual,
    'moneda', 'MXN',
    'tc', jsonb_build_object('usd_mxn', v_usd, 'eur_mxn', v_eur, 'faltante', COALESCE(v_faltante, false))
  );
END;
$function$;

-- H6 — endurecimiento de SECURITY DEFINER (sin ejecución para PUBLIC/anon).
REVOKE ALL ON FUNCTION public.saldo_factura_proveedor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.saldo_factura_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura_proveedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.saldo_factura_proveedor(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.proveedor_salud(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_salud(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_salud(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_salud(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.a_mxn(numeric, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.a_mxn(numeric, text, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.a_mxn(numeric, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.a_mxn(numeric, text, numeric, numeric) TO service_role;
REVOKE ALL ON FUNCTION public.monto_pago_en_moneda_factura(numeric, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.monto_pago_en_moneda_factura(numeric, text, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.monto_pago_en_moneda_factura(numeric, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.monto_pago_en_moneda_factura(numeric, text, numeric, text) TO service_role;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM anon;