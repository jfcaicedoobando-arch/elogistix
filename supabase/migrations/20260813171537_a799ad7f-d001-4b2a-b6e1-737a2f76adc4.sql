-- Ola 12 · Sprint 05 · R3P-09 + R3P-10 (Proveedor 360).
-- ACUMULATIVA sobre la versión vigente de 5 argumentos (p_limite/p_offset,
-- paginación server-side y metadata de truncamiento del Sprint 04).
-- R3P-09: los saldos por moneda se derivan del universo GLOBAL de movimientos
--         (mismo criterio que el aging), no del periodo filtrado.
-- R3P-10: los buckets del aging usan la fecha de negocio CDMX en vez de
--         CURRENT_DATE (UTC del servidor).
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
  v_movs jsonb;
  v_movs_full jsonb;
  v_aging jsonb;
  v_saldos jsonb;
  v_total integer;
  v_offset_efectivo integer;
  v_desde date := COALESCE(p_desde, '1900-01-01'::date);
  v_hasta date := COALESCE(p_hasta, '2999-12-31'::date);
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 5000);
  -- R3P-10: fecha de negocio en America/Mexico_City.
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  -- Universo COMPLETO de movimientos (sin filtro de periodo).
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
    SELECT nc.id, nc.folio_nc, nc.fecha, nc.monto, nc.moneda::text AS moneda,
           nc.proveedor_factura_id, f.folio_interno, f.expediente, f.embarque_id
    FROM public.proveedor_notas_credito nc
    JOIN facturas f ON f.id = nc.proveedor_factura_id
    WHERE nc.organization_id = v_oid
      AND nc.deleted_at IS NULL
      AND nc.estado IN ('Aprobada', 'Aplicada')
  ),
  pagos AS (
    SELECT pp.id, pp.fecha_pago, pp.monto, pp.moneda::text AS moneda,
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
           COALESCE(p.expediente, ''), p.embarque_id, p.moneda,
           0::numeric, COALESCE(p.monto, 0), p.metodo_pago
    FROM pagos p
    UNION ALL
    SELECT a.fecha_anticipo, 'Anticipo', a.id, 'Anticipo', a.referencia,
           COALESCE(a.expediente, ''), a.embarque_id, a.moneda,
           0::numeric, 0::numeric, a.metodo_pago
    FROM anticipos a
  )
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.fecha, m.tipo, m.folio), '[]'::jsonb)
  INTO v_todos
  FROM movs m;

  -- Detalle del periodo: filtro en memoria sobre el universo completo.
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

  -- Aging global con fecha de corte CDMX (R3P-10).
  WITH facturas AS (
    SELECT pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_vencimiento,
           pf.moneda::text AS moneda, COALESCE(pf.total, 0) AS total
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  saldo_factura AS (
    SELECT f.id, f.moneda, f.fecha_vencimiento,
           f.total
             - COALESCE((SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
                         WHERE pp.proveedor_factura_id = f.id AND pp.deleted_at IS NULL), 0)
             - COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
                         WHERE nc.proveedor_factura_id = f.id AND nc.deleted_at IS NULL
                           AND nc.estado IN ('Aprobada','Aplicada')), 0) AS saldo
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

  -- Saldos GLOBALES por moneda (R3P-09): universo completo, igual que el aging.
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
    'aging', v_aging,
    'saldos', v_saldos,
    'total_movimientos', v_total,
    'hay_mas', v_offset_efectivo > 0 OR (v_offset_efectivo + v_limite) < v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta_movimientos(uuid, date, date, integer, integer) TO service_role;

-- Ola 12 · Sprint 05 · R3P-17: dias_facturacion_prom sin colapso a 0.
-- Se reescribe la definición vigente aplicando dos ajustes puntuales:
--   1) primera_emision con COALESCE defensivo a pf.created_at::date;
--   2) las emisiones anteriores al alta del concepto se EXCLUYEN del promedio
--      en vez de colapsarse a 0 con GREATEST(...,0).
DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'proveedor_inteligencia';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'proveedor_inteligencia no existe: revisa el orden de migraciones';
  END IF;

  v_def := replace(
    v_def,
    'MIN(pf.fecha_emision) AS primera_emision',
    'MIN(COALESCE(pf.fecha_emision, pf.created_at::date)) AS primera_emision'
  );
  v_def := replace(
    v_def,
    'SELECT ROUND(AVG(GREATEST(primera_emision - created_at::date, 0))::numeric, 1)
      FROM part WHERE primera_emision IS NOT NULL',
    'SELECT ROUND(AVG(primera_emision - created_at::date)::numeric, 1)
      FROM part WHERE primera_emision IS NOT NULL
        AND primera_emision >= created_at::date'
  );

  IF position('GREATEST(primera_emision' in v_def) > 0 THEN
    RAISE EXCEPTION 'R3P-17: no se pudo aplicar el ajuste de dias_facturacion_prom';
  END IF;

  EXECUTE v_def;
END
$do$;

REVOKE ALL ON FUNCTION public.proveedor_inteligencia(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_inteligencia(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_inteligencia(uuid) TO authenticated, service_role;