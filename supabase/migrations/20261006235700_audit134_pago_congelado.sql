-- Audit134 forward split: frozen application conversion, no historical rewrite.
-- Closure keeps main membership/aggregation here; audit139 is a separate dependency.

-- Audit134: select the persisted application amount without reconstructing FX.
-- Direct payments retain monto_pago_en_moneda_factura and its existing semantics.
-- NULL on an applied advance means unknown, even when a separate rate exists.
CREATE OR REPLACE FUNCTION public.monto_pago_proveedor_en_moneda_factura(
  p_es_anticipo_aplicado boolean,
  p_monto_en_moneda_factura numeric,
  p_monto numeric,
  p_moneda_pago text,
  p_tc_pago numeric,
  p_moneda_factura text
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN p_es_anticipo_aplicado THEN p_monto_en_moneda_factura
    ELSE public.monto_pago_en_moneda_factura(
      p_monto, p_moneda_pago, p_tc_pago, p_moneda_factura)
  END;
$function$;

REVOKE ALL ON FUNCTION public.monto_pago_proveedor_en_moneda_factura(boolean, numeric, numeric, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monto_pago_proveedor_en_moneda_factura(boolean, numeric, numeric, text, numeric, text) TO authenticated, service_role;


-- Canonical schema para public.saldo_factura_proveedor (Ola 12 · R3P-01, migración 20260823100100;
-- re-emitida con org guard en Ola 13 · Sprint 07 / R4BD-02, migración 20260824070000).
-- Saldo de una factura de proveedor en su propia moneda; NC sólo 'Aplicada'
-- y pagos convertidos con monto_pago_en_moneda_factura. Los anticipos
-- aplicados usan sólo el importe congelado en el pago; NULL es desconocido (audit134).
-- Org guard: 42501 'LC_ORG_SIN_CONTEXTO' sin contexto; la factura debe
-- pertenecer a la organización activa y no estar cancelada (NULL en otro caso,
-- igual que inexistente/eliminada/ajena → no es oráculo de existencia).
CREATE OR REPLACE FUNCTION public.saldo_factura_proveedor(p_factura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_f public.proveedor_facturas;
  v_pagado numeric;
  v_nc numeric;
  v_incompleto boolean;
  v_nc_incompleto boolean;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_f
  FROM public.proveedor_facturas
  WHERE id = p_factura_id
    AND deleted_at IS NULL
    AND organization_id = v_oid
    AND estado <> 'Cancelada';

  IF v_f.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(p.monto_factura), 0), BOOL_OR(p.monto_factura IS NULL)
    INTO v_pagado, v_incompleto
  FROM (
    SELECT public.monto_pago_proveedor_en_moneda_factura(
      pp.es_anticipo_aplicado, pp.monto_en_moneda_factura,
      pp.monto, pp.moneda::text, pp.tipo_cambio_usd, v_f.moneda::text
    ) AS monto_factura
    FROM public.pagos_proveedor pp
    WHERE pp.proveedor_factura_id = p_factura_id
      AND pp.deleted_at IS NULL
  ) p;

  -- Ola 17 · H8-B: la NC se valúa en la moneda de la factura con su TC DOF.
  SELECT COALESCE(SUM(public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, v_f.moneda::text)), 0),
         BOOL_OR(public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, v_f.moneda::text) IS NULL)
    INTO v_nc, v_nc_incompleto
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
    'flujo_incompleto', COALESCE(v_incompleto, false) OR COALESCE(v_nc_incompleto, false)
  );
END;
$function$;


REVOKE ALL ON FUNCTION public.saldo_factura_proveedor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura_proveedor(uuid) TO authenticated, service_role;


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


-- Fuente canónica de public.validar_cierre_embarque
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.
-- v13.381.1: paso 1 incluye costos sin proveedor; paso 2 falla con buzón vacío + costos sin factura.
-- N-BL-01 (v13.666.0): pagado CxP convertido a la moneda de la factura con
-- monto_pago_en_moneda_factura; fail-closed (pago sin TC se excluye y se reporta
-- en pagos_sin_tipo_cambio), consistente con saldo_factura_proveedor.
-- v13.823.291: alineado con resolver_sin_comision (clientes con sin_comision).
-- P1-1: venta_conceptos_facturados exige factura vigente EMITIDA por concepto y
-- fail-closed si queda otra factura vigente SIN emitir de la misma proforma
-- (proforma partida por moneda); se reportan en detalle.facturados_sin_emitir.

CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb; v_puede boolean := true; v_ok boolean;
  v_cxc_saldo numeric := 0; v_cxc_por_moneda jsonb := '[]'::jsonb;
  v_cxc_pagadas_sin_pago int := 0;
  v_cxp_saldo numeric := 0; v_cxp_por_moneda jsonb := '[]'::jsonb;
  v_docs_faltantes int;
  v_utilidad_mxn numeric; v_venta_mxn numeric; v_margen_min numeric; v_margen_pct numeric;
  v_pnl jsonb; v_com_count int; v_sin_comision boolean := false;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int; v_venta_sin_emitir int := 0;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
  v_ent_pendientes int := 0; v_ent_dias_max int := 0;
  v_ent_total int := 0; v_ent_vacio boolean := false;
  v_prov_sin_evidencia int := 0; v_prov_nombres text[] := ARRAY[]::text[];
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
  -- v13.820.6: las fechas de descarga/devolución sólo aplican a contenedores
  -- completos (Marítimo FCL). En LCL (caja compartida) y otros modos no hay
  -- contenedor que descargar/devolver, aunque existan filas de agrupación.
  IF v_tiene_contenedores AND v_emb.modo='Marítimo' AND COALESCE(v_emb.tipo_carga,'') ILIKE 'FCL%' THEN
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
  -- Buzón CxP: ningún invoice puede quedar sin capturar.
  SELECT COUNT(*),
         COALESCE(MAX(GREATEST(0, (now()::date - efe.created_at::date))), 0)
    INTO v_ent_pendientes, v_ent_dias_max
    FROM embarque_facturas_entrantes efe
   WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
     AND COALESCE(efe.estado,'por_capturar')='por_capturar';
  SELECT COUNT(*) INTO v_ent_total
    FROM embarque_facturas_entrantes efe
   WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
     AND COALESCE(efe.estado,'por_capturar')<>'rechazada';
  v_ent_vacio := (v_ent_total=0 AND v_costos_sin_factura>0);
  v_ok := (v_ent_pendientes=0 AND NOT v_ent_vacio); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','facturas_entrantes_capturadas','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_ent_pendientes, 'dias_max', v_ent_dias_max,
      'buzon_vacio', v_ent_vacio, 'costos_sin_factura', v_costos_sin_factura)));
  -- Evidencia: cada proveedor con costos debe tener al menos un archivo en el
  -- buzón. v13.820.4: un costo ya ligado a una factura de proveedor vigente
  -- cuenta como evidencia aunque la factura no haya entrado por el buzón
  -- (captura directa desde Costos); antes el paso 1 quedaba pendiente para
  -- siempre pese a que el paso 3 estaba completo.
  SELECT COUNT(*), COALESCE(array_agg(nombre ORDER BY nombre), ARRAY[]::text[])
    INTO v_prov_sin_evidencia, v_prov_nombres
    FROM (
      SELECT DISTINCT COALESCE(NULLIF(cc.proveedor_nombre,''), 'Proveedor sin nombre') AS nombre
        FROM conceptos_costo cc
       WHERE cc.embarque_id=p_embarque_id AND cc.deleted_at IS NULL
         AND cc.proveedor_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM embarque_facturas_entrantes efe
            WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
              AND efe.proveedor_id=cc.proveedor_id
              AND COALESCE(efe.estado,'por_capturar')<>'rechazada')
         AND NOT EXISTS (
           SELECT 1 FROM proveedor_facturas_conceptos pfc
           JOIN proveedor_facturas pf3 ON pf3.id=pfc.proveedor_factura_id
            WHERE pfc.concepto_costo_id=cc.id
              AND pf3.deleted_at IS NULL AND pf3.estado<>'Cancelada')
      UNION
      SELECT 'Costos sin proveedor asignado' AS nombre
       WHERE EXISTS (
         SELECT 1 FROM conceptos_costo cc2
          WHERE cc2.embarque_id=p_embarque_id AND cc2.deleted_at IS NULL
            AND cc2.proveedor_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM proveedor_facturas_conceptos pfc2
              JOIN proveedor_facturas pf4 ON pf4.id=pfc2.proveedor_factura_id
               WHERE pfc2.concepto_costo_id=cc2.id
                 AND pf4.deleted_at IS NULL AND pf4.estado<>'Cancelada'))
    ) faltantes;
  v_ok := (v_prov_sin_evidencia=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','facturas_entrantes_evidencia','ok',v_ok,
    'detalle', jsonb_build_object('proveedores_sin_evidencia', v_prov_sin_evidencia, 'proveedores', v_prov_nombres)));
  -- N-BL-01: el pagado CxP se convierte a la moneda de la factura con
  -- selector canónico (antes sumaba pp.monto en crudo: una factura
  -- USD pagada en MXN inflaba el pagado ~19x y permitía cerrar con CxP
  -- pendiente). Fail-closed consistente con saldo_factura_proveedor: un pago
  -- sin tipo de cambio con moneda distinta se EXCLUYE del pagado (nunca 1:1
  -- silencioso) y se reporta en pagos_sin_tipo_cambio.
  -- Audit134: anticipo aplicado usa sólo monto_en_moneda_factura congelado;
  -- NULL es desconocido. La pertenencia/agrupación sigue igual hasta audit139.
  WITH pagos AS (
    SELECT pp.proveedor_factura_id,
      SUM(public.monto_pago_proveedor_en_moneda_factura(
        pp.es_anticipo_aplicado, pp.monto_en_moneda_factura,
        pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) AS pagado,
      BOOL_OR(public.monto_pago_proveedor_en_moneda_factura(
        pp.es_anticipo_aplicado, pp.monto_en_moneda_factura,
        pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text) IS NULL) AS sin_tc
    FROM pagos_proveedor pp JOIN proveedor_facturas pf ON pf.id=pp.proveedor_factura_id
    WHERE pp.deleted_at IS NULL AND pf.embarque_id=p_embarque_id
      AND pf.deleted_at IS NULL AND pf.estado<>'Cancelada'
    GROUP BY pp.proveedor_factura_id
  ), agg AS (
    SELECT COALESCE(pf.moneda,'MXN') AS moneda, COALESCE(SUM(pf.total),0) AS total,
      COALESCE(SUM(p.pagado),0) AS pagado,
      COUNT(*) FILTER (WHERE pf.total > COALESCE(p.pagado,0) + 0.01) AS facturas_pendientes,
      COUNT(*) FILTER (WHERE p.sin_tc) AS pagos_sin_tipo_cambio
    FROM proveedor_facturas pf LEFT JOIN pagos p ON p.proveedor_factura_id=pf.id
    WHERE pf.embarque_id=p_embarque_id AND pf.deleted_at IS NULL AND pf.estado<>'Cancelada'
    GROUP BY COALESCE(pf.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,
      'saldo',GREATEST(total-pagado,0),'facturas_pendientes',facturas_pendientes,
      'pagos_sin_tipo_cambio',pagos_sin_tipo_cambio
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(total-pagado,0)),0)
  INTO v_cxp_por_moneda, v_cxp_saldo FROM agg;
  -- BUG-13: el umbral se evalúa POR moneda; sumar saldos de monedas distintas
  -- mezcla unidades y puede pasar con USD pendiente compensado con MXN.
  v_ok := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_cxp_por_moneda) m
    WHERE (m->>'saldo')::numeric > 0.01 OR (m->>'pagos_sin_tipo_cambio')::integer>0);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxp_por_moneda, 'saldo_total', v_cxp_saldo)));
  -- P1-1 (v13.824.x): `estado_facturacion='facturado'` se enciende en cuanto la
  -- proforma queda 'facturada', y eso ocurre al crear una factura BORRADOR.
  -- Fail-closed: un concepto sólo cuenta como facturado si (a) existe factura
  -- vigente EMITIDA ligada a su proforma y (b) NO queda ninguna factura vigente
  -- de esa misma proforma sin emitir (Borrador/Por timbrar). Esto cubre la
  -- proforma partida por moneda (facturas USD + MXN comparten proforma_id):
  -- emitir sólo una ya no da OK. Cancelada/Sustituida no bloquean ni acreditan.
  -- P1 (v13.824.x): el vínculo además exige MISMA MONEDA que el concepto
  -- (conceptos_venta.moneda ↔ facturas.moneda), porque construirFacturasAEmitir
  -- genera una factura por moneda desde total_usd/total_mxn: una proforma mixta
  -- con la USD Emitida y la MXN Cancelada dejaba el concepto MXN sin cubrir y
  -- daba OK. Una factura emitida en otra moneda no acredita al concepto.
  -- El vínculo factura↔proforma usa facturas.proforma_id, los punteros
  -- proformas.factura_id / factura_secundaria_id y conceptos_factura
  -- .proforma_id_origen (consolidadas). Conceptos legacy sin proforma se
  -- validan contra cualquier factura emitida del embarque en su moneda.
  WITH cv AS (
    SELECT cv.id, cv.estado_facturacion, cv.proforma_id,
           COALESCE(cv.moneda::text,'MXN') AS moneda
      FROM conceptos_venta cv
     WHERE cv.embarque_id=p_embarque_id AND cv.deleted_at IS NULL),
  lig AS (
    SELECT c.id AS cv_id, f.estado::text AS estado
      FROM cv c
      JOIN facturas f
        ON f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
       AND COALESCE(f.moneda::text,'MXN') = c.moneda
       AND (c.proforma_id IS NULL
            OR f.proforma_id = c.proforma_id
            OR EXISTS (SELECT 1 FROM proformas pr
                        WHERE pr.id=c.proforma_id AND pr.deleted_at IS NULL
                          AND f.id IN (pr.factura_id, pr.factura_secundaria_id))
            OR EXISTS (SELECT 1 FROM conceptos_factura cf
                        WHERE cf.factura_id=f.id AND cf.deleted_at IS NULL
                          AND cf.proforma_id_origen = c.proforma_id)))
  SELECT COUNT(*) FILTER (WHERE c.estado_facturacion='pendiente'),
         COUNT(*) FILTER (WHERE c.estado_facturacion='en_proforma'),
         COUNT(*) FILTER (WHERE c.estado_facturacion='facturado' AND (
           NOT EXISTS (SELECT 1 FROM lig l WHERE l.cv_id=c.id
                        AND l.estado IN ('Emitida','Pagada','Parcialmente pagada','Vencida'))
           OR EXISTS (SELECT 1 FROM lig l WHERE l.cv_id=c.id
                       AND l.estado NOT IN ('Emitida','Pagada','Parcialmente pagada',
                                            'Vencida','Cancelada','Sustituida'))))
    INTO v_venta_pendientes, v_venta_en_proforma, v_venta_sin_emitir
    FROM cv c;

  v_ok := (v_venta_pendientes=0 AND v_venta_en_proforma=0 AND v_venta_sin_emitir=0);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','venta_conceptos_facturados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_venta_pendientes,
      'en_proforma', v_venta_en_proforma, 'facturados_sin_emitir', v_venta_sin_emitir)));
  -- CxC: una factura con estado 'Pagada' se considera saldo 0 aunque no tenga
  -- pagos capturados (facturas históricas conciliadas fuera del sistema).
  SELECT COUNT(*) INTO v_cxc_pagadas_sin_pago
    FROM facturas f
   WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL AND f.estado='Pagada'
     AND public.saldo_factura(f.id) > 0.01;
  WITH agg AS (
    SELECT COALESCE(f.moneda,'MXN') AS moneda, COALESCE(SUM(f.total),0) AS total,
      COALESCE(SUM(CASE WHEN f.estado='Pagada' THEN 0
                        ELSE public.saldo_factura(f.id) END),0) AS saldo,
      COALESCE(SUM((SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) FROM pagos_factura pf
        WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL)),0) AS pagado,
      COALESCE(SUM((SELECT COALESCE(SUM(nc.monto),0) FROM factura_notas_credito nc
        WHERE nc.factura_id=f.id AND nc.deleted_at IS NULL AND nc.estado IN ('Timbrada','Aplicada'))),0) AS notas_credito,
      COUNT(*) FILTER (WHERE f.estado<>'Pagada' AND public.saldo_factura(f.id) > 0.01) AS facturas_pendientes
    FROM facturas f
    WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
      AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
    GROUP BY COALESCE(f.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,'notas_credito',notas_credito,
      'saldo',GREATEST(saldo,0),'facturas_pendientes',facturas_pendientes
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(saldo,0)),0)
  INTO v_cxc_por_moneda, v_cxc_saldo FROM agg;
  -- BUG-13: el umbral se evalúa POR moneda; sumar saldos de monedas distintas
  -- mezcla unidades y puede pasar con USD pendiente compensado con MXN.
  v_ok := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_cxc_por_moneda) m
    WHERE (m->>'saldo')::numeric > 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxc_por_moneda, 'saldo_total', v_cxc_saldo,
      'pagadas_sin_pago_registrado', v_cxc_pagadas_sin_pago)));
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
  -- Ola 2 · O2.2: se bloquea por pendientes REALES (nota de pendiente o
  -- cola de recálculo), no por la bandera `definitiva` que sólo se marca al
  -- cerrar (círculo vicioso que obligaba a "forzar" todos los cierres).
  -- v13.823.291: si el embarque no genera comisión (override propio o cliente
  -- marcado `sin_comision`), el check NO bloquea: la UI ya lo muestra en gris
  -- "No aplica" y el checklist se veía completo mientras el candado contaba una
  -- comisión huérfana (ELIMP00298: nota "Sin vendedora asignada al embarque").
  v_sin_comision := public.resolver_sin_comision(p_embarque_id);
  IF v_sin_comision THEN
    v_com_count := 0;
  ELSE
    SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas cd
     WHERE cd.embarque_id=p_embarque_id
       AND cd.estado='Devengada' AND cd.deleted_at IS NULL
       AND cd.nota IS NOT NULL;
    IF EXISTS (SELECT 1 FROM comisiones_recalculo_pendiente crp
                 JOIN pagos_factura pf2 ON pf2.id = crp.pago_factura_id
                 JOIN facturas f2 ON f2.id = pf2.factura_id
                WHERE f2.embarque_id = p_embarque_id
                  AND crp.resuelto_at IS NULL) THEN
      v_com_count := v_com_count + 1;
    END IF;
  END IF;
  v_ok := (v_com_count=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comisiones_definitivas','ok',v_ok,
    'detalle', jsonb_build_object('no_definitivas', v_com_count,
      'sin_comision', v_sin_comision)));

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
END $$;

REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated, service_role;
