-- H14 inverse-family regression. Include after serial.sql has rolled back.
-- An independent transaction recreates the reviewed temporary constructors.
-- Only fictitious rows in the owned local clone; no production timing claim.
BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '5s';
\ir fixture_helpers.sql
DO $$ BEGIN
  IF current_database() !~ '^h14_finance_[0-9a-f]{32}$' OR inet_server_addr() IS NOT NULL
     OR current_setting('unix_socket_directories') NOT IN('/lab','/var/run/postgresql') OR current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'H14_PERF_TEST_REQUIRES_OWNED_LOCAL_CLONE';
  END IF;
  IF to_regprocedure('pg_temp.h14_fin_seed(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'H14_PERF_TEST_REQUIRES_REVIEWED_FINANCE_CONSTRUCTORS';
  END IF;
END $$;

-- Exact invoice-branch relation before the optimization. This oracle calls the
-- actual canonical per-shipment resolver, not a separately invented lineage rule.
CREATE FUNCTION pg_temp.h14_invoice_targets_before(p_org uuid, p_row jsonb)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH roots AS (
    SELECT COALESCE(array_agg(DISTINCT id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) AS ids FROM (
      SELECT (p_row->>'proforma_id')::uuid AS id
      UNION SELECT cf.proforma_id_origen FROM public.conceptos_factura cf
        WHERE cf.factura_id = (p_row->>'id')::uuid AND cf.organization_id = p_org AND cf.deleted_at IS NULL
      UNION SELECT p.id FROM public.proformas p WHERE p.organization_id = p_org
        AND (p_row->>'id')::uuid IN (p.factura_id, p.factura_secundaria_id)
    ) q
  )
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id) FILTER (WHERE id IS NOT NULL), ARRAY[]::uuid[]) FROM (
    SELECT (p_row->>'embarque_id')::uuid AS id
    UNION SELECT fe.embarque_id FROM public.factura_embarques fe
      WHERE fe.factura_id = (p_row->>'id')::uuid AND fe.organization_id = p_org AND fe.activa IS TRUE
    UNION SELECT cf.embarque_id FROM public.conceptos_factura cf
      WHERE cf.factura_id = (p_row->>'id')::uuid AND cf.organization_id = p_org AND cf.deleted_at IS NULL
    UNION SELECT e.id FROM public.embarques e CROSS JOIN roots r
      WHERE e.organization_id = p_org AND public._h14_proformas_baja_embarque(e.id, p_org) && r.ids
  ) q;
$$;

CREATE TEMP TABLE h14_perf_results(case_id text PRIMARY KEY, evidence jsonb NOT NULL);
DO $test$
DECLARE
  f jsonb; fb jsonb; org uuid; client uuid; i integer;
  e uuid[]; source1 uuid; source2 uuid; parent uuid; cycle1 uuid; cycle2 uuid;
  historical uuid; foreign_source uuid; cv_deleted uuid;
  root uuid; row_candidate jsonb; expected uuid[]; before_ids uuid[]; after_ids uuid[];
  case_name text; targets uuid[]; c record;
  t_started timestamptz; t_legacy_done timestamptz; t_proposed_done timestamptz;
BEGIN
  f := pg_temp.h14_fin_seed('PERF-INVERSE-FAMILY'); org := (f->>'org_a')::uuid; client := (f->>'cliente_a')::uuid;
  -- Fixed cardinality and UUIDs. No timings or EXPLAIN counters are asserted.
  INSERT INTO public.embarques(id, organization_id, cliente_id, modo, tipo, estado, tipo_cambio_usd, tipo_cambio_eur)
    SELECT pg_temp.h14_fin_uuid(f->>'case_key', 'scale-shipment-' || n), org, client,
      'Aéreo', 'Importación', 'Borrador', 20, 22 FROM generate_series(1, 2012) AS s(n);
  SELECT array_agg(pg_temp.h14_fin_uuid(f->>'case_key', 'scale-shipment-' || n) ORDER BY n) INTO e FROM generate_series(1, 12) AS s(n);
  source1 := pg_temp.h14_fin_proforma(f, 'source-1', e[1]);
  source2 := pg_temp.h14_fin_proforma(f, 'source-2', e[7]);
  parent := pg_temp.h14_fin_proforma(f, 'parent', NULL);
  UPDATE public.proformas SET embarques_ids = ARRAY[e[2], e[2]], consolidada_en = parent WHERE id = source1;
  UPDATE public.proformas SET proformas_origen = ARRAY[source1, source2] WHERE id = parent;
  INSERT INTO public.proforma_conceptos_consolidados(id, organization_id, proforma_id, embarque_id, descripcion, tipo_iva, tasa_iva_aplicada)
    VALUES(pg_temp.h14_fin_uuid(f->>'case_key', 'pcc-live'), org, source1, e[3], 'PERF FICTICIO LIVE', 'no_objeto', 0),
      (pg_temp.h14_fin_uuid(f->>'case_key', 'pcc-deleted'), org, source1, e[5], 'PERF FICTICIO DELETED', 'no_objeto', 0);
  UPDATE public.proforma_conceptos_consolidados SET deleted_at = now() WHERE id = pg_temp.h14_fin_uuid(f->>'case_key', 'pcc-deleted');
  PERFORM pg_temp.h14_fin_sale(f, 'cv-live', e[4], source1);
  cv_deleted := pg_temp.h14_fin_sale(f, 'cv-deleted', e[6], source1);
  UPDATE public.conceptos_venta SET deleted_at = now() WHERE id = cv_deleted;
  cycle1 := pg_temp.h14_fin_proforma(f, 'cycle-1', e[8]);
  cycle2 := pg_temp.h14_fin_proforma(f, 'cycle-2', e[9]);
  UPDATE public.proformas SET proformas_origen = ARRAY[cycle2] WHERE id = cycle1;
  UPDATE public.proformas SET proformas_origen = ARRAY[cycle1], consolidada_en = cycle1 WHERE id = cycle2;
  historical := pg_temp.h14_fin_proforma(f, 'historical', e[10]);
  UPDATE public.proformas SET deleted_at = now() WHERE id = historical;
  fb := f || jsonb_build_object('org_a', f->>'org_b', 'cliente_a', f->>'cliente_b');
  foreign_source := pg_temp.h14_fin_proforma(fb, 'foreign-source', (f->>'embarque_b')::uuid);
  FOR i IN 1..80 LOOP
    PERFORM pg_temp.h14_fin_proforma(f, 'unrelated-proforma-' || i, pg_temp.h14_fin_uuid(f->>'case_key', 'scale-shipment-' || (100 + i)));
  END LOOP;
  FOR c IN SELECT * FROM (VALUES
    ('empty-roots', NULL::uuid, ARRAY[]::uuid[]),
    ('source-without-parent-sibling', source1, ARRAY[e[1],e[2],e[3],e[4]]),
    ('parent-with-sources', parent, ARRAY[e[1],e[2],e[3],e[4],e[7]]),
    ('cycle', cycle1, ARRAY[e[8],e[9]]),
    ('historical-source-preserved', historical, ARRAY[e[10]]),
    ('foreign-root-ignored-in-org-a', foreign_source, ARRAY[]::uuid[]),
    ('missing-root-ignored', pg_temp.h14_fin_uuid(f->>'case_key', 'missing-proforma'), ARRAY[]::uuid[])
  ) AS v(case_name, root, expected_ids)
  LOOP
    SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::uuid[]) INTO expected FROM unnest(c.expected_ids) AS u(x);
    -- A candidate pre-insert invoice legitimately does not exist in the table.
    row_candidate := jsonb_build_object('id', pg_temp.h14_fin_uuid(f->>'case_key', 'candidate-' || c.case_name),
      'organization_id', org, 'embarque_id', NULL, 'proforma_id', c.root);
    t_started := clock_timestamp();
    before_ids := pg_temp.h14_invoice_targets_before(org, row_candidate);
    t_legacy_done := clock_timestamp();
    after_ids := public._h14_grafo_fila_baja(org, 'facturas', row_candidate);
    t_proposed_done := clock_timestamp();
    INSERT INTO h14_perf_results VALUES(c.case_name, jsonb_build_object('case_id', c.case_name,
      'old', before_ids, 'new', after_ids, 'expected', expected, 'matched',
        before_ids IS NOT DISTINCT FROM after_ids AND after_ids IS NOT DISTINCT FROM expected,
      'unrelated_shipments', 2000, 'fixture_extra_shipments_including_anchors', 2012, 'unrelated_proformas', 80,
      'legacy_ms', round((extract(epoch FROM t_legacy_done - t_started) * 1000)::numeric, 3),
      'proposed_ms', round((extract(epoch FROM t_proposed_done - t_legacy_done) * 1000)::numeric, 3),
      'timing_order', 'legacy then proposed; local wall time only; no threshold or production estimate',
      'query_plan_claimed', false));
  END LOOP;
END $test$;
SELECT 'H14_PERF_EQ ' || evidence::text FROM h14_perf_results ORDER BY case_id;
SELECT 'H14_RESULT ' || jsonb_build_object(
  'case_id', 'P03.inverse_family_scale', 'matrix_id', 'P03', 'tier', 'S',
  'expected_by_code', jsonb_build_object('relation_equivalent', true, 'scenarios', 7,
    'unrelated_shipments', 2000, 'unrelated_proformas', 80),
  'observed', jsonb_build_object('comparisons', (SELECT jsonb_agg(evidence ORDER BY case_id) FROM h14_perf_results),
    'timing_scope', 'observed local clock_timestamp differences in fixed old/new order; no production estimate',
    'roles_or_permissions_changed', false),
  'status', CASE WHEN (SELECT count(*)=7 AND bool_and((evidence->>'matched')::boolean) FROM h14_perf_results) THEN 'RELATION_EQUIVALENT' ELSE 'RELATION_DIFFERENT' END,
  'reproduction_complete', (SELECT count(*)=7 AND bool_and((evidence->>'matched')::boolean) FROM h14_perf_results)
)::text;
DO $$ BEGIN
  PERFORM pg_temp.h14_fin_assert((SELECT count(*) = 7 AND bool_and((evidence->>'matched')::boolean) FROM h14_perf_results),
    'all seven inverse-family comparisons must match old/new/expected sets');
END $$;
ROLLBACK;
