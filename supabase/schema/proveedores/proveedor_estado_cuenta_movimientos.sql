-- ============================================================
-- Ola 13 · Sprint 04 · R4BD-05 (proveedor_estado_cuenta_movimientos):
-- p_offset se cuenta DESDE EL FINAL (antes empujaba la ventana hacia
-- adelante y los renglones viejos eran inalcanzables). 'hay_mas' = hay
-- renglones anteriores a la ventana.
-- Migración vigente: 20261006235700_audit134_pago_congelado.sql,
-- acumulativa sobre la final de Ola 12 (20260813190546, Sprint 10) — conserva
-- R3FE-04, R3P-09, R3P-10, R3BD-04, R3FE-03, R3P-07/R3P-08 y R3P-06.
-- Auditoría70: NC y aging en moneda de factura con conversión canónica.
-- Auditoría71: contrapartida de devolución por el monto efectivamente devuelto.
-- Espejo 1:1 obligatorio (lo verifica audit:schema-functions).
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
  -- Sprint 04 · R3FE-04: tope defensivo (nunca se devuelven > 5000).
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 5000);
  -- R3P-10: fecha de negocio en America/Mexico_City. Antes CURRENT_DATE usaba
  -- la fecha UTC del servidor: entre las 18:00-23:59 CDMX los buckets del
  -- aging se calculaban "mañana".
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  -- Universo completo de movimientos del proveedor (SIN filtro de periodo):
  -- se materializa una sola vez y de él se derivan el detalle del periodo,
  -- la apertura (S08 · R3FE-03) y los saldos globales.
  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_emision,
           pf.fecha_vencimiento, pf.moneda::text AS moneda, pf.total,
           pf.estado::text AS estado, pf.embarque_id, e.expediente
    FROM public.proveedor_facturas pf
    LEFT JOIN public.embarques e ON e.id = pf.embarque_id AND e.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  notas AS (
    -- R3P-08: sólo NC aplicadas descuentan el estado de cuenta (regla única).
    SELECT nc.id, nc.folio_nc, nc.fecha,
           nc.monto AS monto_nota, nc.moneda::text AS moneda_nota,
           public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda) AS monto_factura,
           f.moneda AS moneda_factura,
           nc.proveedor_factura_id, f.folio_interno, f.expediente, f.embarque_id
    FROM public.proveedor_notas_credito nc
    JOIN facturas f ON f.id = nc.proveedor_factura_id
    WHERE nc.organization_id = v_oid
      AND nc.deleted_at IS NULL
      AND nc.estado = 'Aplicada'
  ),
  pagos AS (
    -- Audit134: la aplicación usa sólo su importe congelado; si falta,
    -- no se reconstruye su FX histórico ni se reclasifica ninguna moneda.
    SELECT pp.id, pp.fecha_pago,
           pp.monto AS monto_pago, pp.moneda::text AS moneda_pago,
           public.monto_pago_proveedor_en_moneda_factura(
             pp.es_anticipo_aplicado, pp.monto_en_moneda_factura,
             pp.monto, pp.moneda::text, pp.tipo_cambio_usd, f.moneda) AS monto_factura,
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
           a.referencia, a.metodo_pago, a.embarque_id, e.expediente,
           COALESCE(a.monto_devuelto, 0) AS monto_devuelto,
           -- La fecha bancaria conserva el periodo efectivo de la devolución.
           -- Legacy sin movimiento: usar la fecha de registro y explicitarlo.
           COALESCE(a.fecha_devolucion, d.fecha,
                    (a.devuelto_at AT TIME ZONE 'America/Mexico_City')::date,
                    (a.updated_at AT TIME ZONE 'America/Mexico_City')::date,
                    a.fecha_anticipo) AS fecha_devolucion,
           COALESCE(a.referencia_devolucion, d.referencia) AS referencia_devolucion,
           a.medio_devolucion,
           a.fecha_devolucion IS NULL AND d.fecha IS NULL AS devolucion_sin_fecha_bancaria
    FROM public.anticipos_proveedor a
    LEFT JOIN public.embarques e ON e.id = a.embarque_id AND e.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT b.fecha, b.referencia
      FROM public.bbva_movimientos b
      WHERE b.anticipo_proveedor_id = a.id
        AND b.organization_id = v_oid
        AND b.deleted_at IS NULL
        AND b.hash_dedupe = 'devolucion-' || a.id::text
        AND b.abono > 0
      ORDER BY b.fecha, b.id
      LIMIT 1
    ) d ON true
    WHERE a.proveedor_id = p_proveedor_id
      AND a.organization_id = v_oid
      AND a.deleted_at IS NULL
      AND a.estado <> 'cancelado'
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
           n.embarque_id, n.moneda_factura, 0::numeric, COALESCE(n.monto_factura, 0),
           CASE
             WHEN n.moneda_nota <> n.moneda_factura AND n.monto_factura IS NULL
               THEN 'NC en ' || n.moneda_nota || ' SIN TC (excluida del saldo)'
             WHEN n.moneda_nota <> n.moneda_factura
               THEN 'NC en ' || n.moneda_nota || ' ' || n.monto_nota::text || ' convertida a ' || n.moneda_factura
             ELSE NULL::text
           END
    FROM notas n
    UNION ALL
    SELECT p.fecha_pago,
           CASE WHEN p.es_anticipo_aplicado THEN 'Anticipo aplicado' ELSE 'Pago' END,
           p.id, COALESCE(p.folio_interno, 'Pago'), p.referencia,
           COALESCE(p.expediente, ''), p.embarque_id,
           -- R3P-06: el abono se expresa en la moneda del cargo (factura).
           p.moneda_factura AS moneda,
           0::numeric,
           -- Audit134: same-currency applications remain informative. A cross
           -- reclassifies credit from advance currency to invoice currency.
           CASE WHEN p.es_anticipo_aplicado AND p.moneda_pago = p.moneda_factura
             THEN 0::numeric ELSE COALESCE(p.monto_factura, 0) END,
           CASE
             WHEN p.es_anticipo_aplicado AND p.moneda_pago = p.moneda_factura
               THEN COALESCE(p.metodo_pago, '') || ' · anticipo ya contado al entregarse'
             WHEN p.moneda_pago <> p.moneda_factura AND p.monto_factura IS NULL
               THEN COALESCE(p.metodo_pago, '') || ' · pagado en ' || p.moneda_pago || ' SIN TC (excluido del saldo)'
             WHEN p.es_anticipo_aplicado
               THEN 'Reclasificación de anticipo de ' || p.moneda_pago || ' a ' || p.moneda_factura || '; sin movimiento bancario'
             WHEN p.moneda_pago <> p.moneda_factura
               THEN COALESCE(p.metodo_pago, '') || ' · pagado en ' || p.moneda_pago
             ELSE p.metodo_pago
           END
    FROM pagos p
    UNION ALL
    SELECT p.fecha_pago, 'Anticipo aplicado', p.id,
           COALESCE(p.folio_interno, 'Aplicación'), p.referencia,
           COALESCE(p.expediente, ''), p.embarque_id, p.moneda_pago,
           p.monto_pago, 0::numeric,
           'Crédito consumido en ' || p.moneda_pago || ' y aplicado a ' || p.moneda_factura || '; sin movimiento bancario'
    FROM pagos p
    WHERE p.es_anticipo_aplicado AND p.moneda_pago <> p.moneda_factura
      AND p.monto_factura IS NOT NULL
    UNION ALL
    SELECT a.fecha_anticipo, 'Anticipo', a.id, 'Anticipo', a.referencia,
           COALESCE(a.expediente, ''), a.embarque_id, a.moneda,
           -- R3P-07: el anticipo entregado ES un abono (dinero al proveedor).
           0::numeric, COALESCE(a.monto, 0), a.metodo_pago
    FROM anticipos a
    UNION ALL
    SELECT a.fecha_devolucion, 'Devolución de anticipo', a.id, 'Devolución de anticipo',
           CASE WHEN a.medio_devolucion IS NOT NULL THEN a.referencia_devolucion ELSE COALESCE(a.referencia_devolucion, a.referencia) END, COALESCE(a.expediente, ''),
           a.embarque_id, a.moneda,
           -- Sólo el dinero devuelto revierte el abono original. Las aplicaciones
           -- sólo reclasifican moneda; no se cuenta de nuevo el dinero entregado.
           a.monto_devuelto, 0::numeric,
           CASE WHEN a.devolucion_sin_fecha_bancaria
             THEN 'Sin fecha bancaria de devolución; fecha de registro como referencia'
             ELSE COALESCE(a.medio_devolucion, a.metodo_pago) END
    FROM anticipos a
    WHERE a.monto_devuelto > 0
  )
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.fecha, m.tipo, m.folio, m.moneda, m.ref_id), '[]'::jsonb)
  INTO v_todos
  FROM movs m;

  -- Detalle del periodo (R3P-09): el filtro se aplica sobre el universo
  -- completo, en memoria, ANTES de paginar (R3FE-04). (Las fechas son
  -- columnas `date`; el casteo desde jsonb es seguro.)
  SELECT COALESCE(jsonb_agg(m ORDER BY m->>'fecha', m->>'tipo', m->>'folio', m->>'moneda', m->>'ref_id'), '[]'::jsonb)
  INTO v_movs_full
  FROM jsonb_array_elements(v_todos) m
  WHERE (m->>'fecha')::date BETWEEN v_desde AND v_hasta;

  -- Sprint 04 · R3FE-04: paginación server-side. La lista es cronológica
  -- ascendente y el saldo corrido se arma en cliente sobre lo devuelto, así
  -- que el recorte por omisión conserva los movimientos MÁS RECIENTES del
  -- periodo.
  v_total := COALESCE(jsonb_array_length(v_movs_full), 0);
  -- Ola 13 · R4BD-05: p_offset se cuenta DESDE EL FINAL. Antes se SUMABA a la
  -- ventana por omisión y los renglones viejos quedaban inalcanzables.
  v_offset_efectivo := GREATEST(v_total - v_limite - GREATEST(COALESCE(p_offset, 0), 0), 0);

  SELECT COALESCE(jsonb_agg(pag.value ORDER BY pag.ord), '[]'::jsonb)
  INTO v_movs
  FROM (
    SELECT t.value, t.ord
    FROM jsonb_array_elements(v_movs_full) WITH ORDINALITY AS t(value, ord)
    ORDER BY t.ord
    OFFSET v_offset_efectivo
    LIMIT v_limite
  ) pag;

  -- Ola 12 · R3FE-03: saldo de apertura por moneda = movimientos anteriores
  -- al periodo. Mismo universo (v_todos) ⇒ cuadra con el corrido y con los
  -- saldos globales.
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

  -- Aging global (sin filtro de periodo; R3P-10: fecha de corte CDMX).
  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_vencimiento,
           pf.moneda::text AS moneda, COALESCE(pf.total, 0) AS total,
           -- Ola 12 · R3BD-04: se necesita el estado para la regla 'Pagada'.
           pf.estado::text AS estado
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  saldo_factura AS (
    SELECT f.id, f.moneda, f.fecha_vencimiento,
           -- Preserve the legacy Pagada shortcut unless an active advance
           -- application lacks its frozen amount. That exceptional unknown
           -- must use known payments/credits, not disappear behind the status.
           CASE WHEN f.estado = 'Pagada' AND NOT EXISTS (
                  SELECT 1 FROM public.pagos_proveedor pp
                  WHERE pp.proveedor_factura_id = f.id AND pp.deleted_at IS NULL
                    AND pp.es_anticipo_aplicado
                    AND public.monto_pago_proveedor_en_moneda_factura(
                      pp.es_anticipo_aplicado, pp.monto_en_moneda_factura,
                      pp.monto, pp.moneda::text, pp.tipo_cambio_usd, f.moneda) IS NULL
                ) THEN 0::numeric
                ELSE f.total
                  -- R3P-06: pagos convertidos a la moneda de la factura.
                  - COALESCE((SELECT SUM(public.monto_pago_proveedor_en_moneda_factura(
                                pp.es_anticipo_aplicado, pp.monto_en_moneda_factura,
                                pp.monto, pp.moneda::text, pp.tipo_cambio_usd, f.moneda))
                              FROM public.pagos_proveedor pp
                              WHERE pp.proveedor_factura_id = f.id AND pp.deleted_at IS NULL), 0)
                  -- R3P-08: sólo NC 'Aplicada' (regla única del módulo).
                  - COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda))
                              FROM public.proveedor_notas_credito nc
                              WHERE nc.proveedor_factura_id = f.id AND nc.deleted_at IS NULL
                                AND nc.organization_id = v_oid
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

  -- Saldos GLOBALES por moneda (R3P-09): mismo universo que el aging
  -- (v_todos), no el periodo filtrado ni la página recortada. La UI los
  -- etiqueta "Saldo global" (Paso 2 del sprint).
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
    -- R4BD-05: hay renglones ANTERIORES a la ventana (más viejos por ver).
    -- Con p_offset=0 el valor es idéntico al de la versión anterior.
    'hay_mas', v_offset_efectivo > 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO service_role;
