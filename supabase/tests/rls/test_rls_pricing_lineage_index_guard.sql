-- Isolated RLS CI only; never run against Live, Lovable, or another shared DB.
-- Auto-discovered by scripts/ci/run-rls-suites.sh from the repository root.
-- The runner uses psql -X -v ON_ERROR_STOP=1 -f on Ubuntu with PostgreSQL 17.
-- Client-side base64 reads checkout bytes: the PostgreSQL container does not
-- need access to the checkout. No installer include, copied guard, or fixture.
-- This is a single-session controlled collision test, NOT real concurrency.
\set ON_ERROR_STOP on
BEGIN;
\ir _helpers.sql
SET LOCAL search_path = public, pg_temp;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

SELECT pg_temp.assert(current_user = 'postgres', 'index guard suite requires the isolated CI owner');
CREATE TEMP TABLE _pricing_lineage_index_source (encoded text NOT NULL);
\copy pg_temp._pricing_lineage_index_source (encoded) FROM PROGRAM 'base64 --wrap=0 supabase/migrations/20261010015800_pricing_cliente_linaje.sql'
CREATE TEMP TABLE _pricing_lineage_index_statements (
  kind text PRIMARY KEY,
  statement text NOT NULL
);

DO $load_index_contract$
DECLARE
  v_encoded text;
  v_source text;
  v_count integer;
  v_statement text;
  v_preflight text;
  v_create text;
  v_postcheck text;
BEGIN
  SELECT encoded INTO STRICT v_encoded FROM pg_temp._pricing_lineage_index_source;
  PERFORM pg_temp.assert(
    encode(pg_catalog.sha256(decode(v_encoded, 'base64')), 'hex') =
      '32fda9c758740c8b77345d6888eabc5bbf6eb52f0105ab2d20215a153e4e8ee6',
    'lineage migration bytes differ from the reviewed index-guard source');
  v_source := convert_from(decode(v_encoded, 'base64'), 'UTF8');

  SELECT count(*), min(m[1]) INTO v_count, v_statement
    FROM regexp_matches(v_source,
      '(?s)(DO \$pricing_index_preflight\$.*?\$pricing_index_preflight\$;)', 'g') AS m;
  PERFORM pg_temp.assert(v_count = 1, 'expected one source preflight DO block');
  v_preflight := v_statement;
  INSERT INTO pg_temp._pricing_lineage_index_statements VALUES ('preflight', v_preflight);

  SELECT count(*), min(m[1]) INTO v_count, v_statement
    FROM regexp_matches(v_source,
      '(?s)(CREATE INDEX IF NOT EXISTS cotizaciones_pricing_solicitud_idx[[:space:]].*?;)', 'g') AS m;
  PERFORM pg_temp.assert(v_count = 1, 'expected one source CREATE INDEX statement');
  v_create := v_statement;
  INSERT INTO pg_temp._pricing_lineage_index_statements VALUES ('create', v_create);

  SELECT count(*), min(m[1]) INTO v_count, v_statement
    FROM regexp_matches(v_source,
      '(?s)(DO \$pricing_index_postcheck\$.*?\$pricing_index_postcheck\$;)', 'g') AS m;
  PERFORM pg_temp.assert(v_count = 1, 'expected one source postcheck DO block');
  v_postcheck := v_statement;
  INSERT INTO pg_temp._pricing_lineage_index_statements VALUES ('postcheck', v_postcheck);
  PERFORM pg_temp.assert(
    strpos(v_source, v_preflight) < strpos(v_source, v_create)
    AND strpos(v_source, v_create) < strpos(v_source, v_postcheck),
    'source order must be preflight, CREATE INDEX, postcheck');

  -- The existing CI replay must have installed the reviewed, exact index.
  -- Execute the actual postcheck, including valid/ready/live and indexdef checks.
  EXECUTE v_postcheck;
END;
$load_index_contract$;

CREATE FUNCTION pg_temp.expect_pricing_index_drift(p_statement text, p_case text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $expect_drift$
DECLARE
  v_rejected boolean := false;
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_message = 'LC_PRICING_SCHEMA_DRIFT',
      p_case || ': wrong error message for SQLSTATE 55000');
    v_rejected := true;
  END;
  -- Kept outside the exception block: a test failure cannot satisfy itself.
  PERFORM pg_temp.assert(v_rejected, p_case || ': source guard did not reject');
END;
$expect_drift$;

CREATE TEMP TABLE _pricing_lineage_index_before AS
  SELECT c.oid, to_jsonb(c) AS relation_catalog, to_jsonb(i) AS index_catalog,
    pg_catalog.pg_get_indexdef(c.oid, 0, false) AS definition
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_index i ON i.indexrelid = c.oid
  WHERE c.oid = 'public.cotizaciones_pricing_solicitud_idx'::regclass;
SELECT pg_temp.assert((SELECT count(*) = 1 FROM pg_temp._pricing_lineage_index_before),
  'expected one installed index snapshot');

SAVEPOINT pricing_lineage_index_cases;
-- Preserve the original OID and all dependencies. Rollback to this savepoint
-- restores the name and removes every test-only index/relation, even on failure
-- when ON_ERROR_STOP causes this psql connection to close and roll back.
ALTER INDEX public.cotizaciones_pricing_solicitud_idx RENAME TO _pricing_lineage_index_saved;

DO $exercise_index_contract$
DECLARE
  v_preflight text;
  v_create text;
  v_postcheck text;
  v_oid oid;
  v_definition text;
BEGIN
  SELECT statement INTO STRICT v_preflight FROM pg_temp._pricing_lineage_index_statements WHERE kind = 'preflight';
  SELECT statement INTO STRICT v_create FROM pg_temp._pricing_lineage_index_statements WHERE kind = 'create';
  SELECT statement INTO STRICT v_postcheck FROM pg_temp._pricing_lineage_index_statements WHERE kind = 'postcheck';

  -- 1. Fresh exact-index success using all three original source statements.
  PERFORM pg_temp.assert(to_regclass('public.cotizaciones_pricing_solicitud_idx') IS NULL,
    'test target name must be free');
  EXECUTE v_preflight;
  EXECUTE v_create;
  EXECUTE v_postcheck;
  v_oid := 'public.cotizaciones_pricing_solicitud_idx'::regclass;
  v_definition := pg_catalog.pg_get_indexdef(v_oid, 0, false);
  RAISE NOTICE 'PASS pricing index guard: fresh exact index';

  -- 2. A compatible preexisting index must still fail installation preflight.
  PERFORM pg_temp.expect_pricing_index_drift(v_preflight, 'compatible preexisting index');
  PERFORM pg_temp.assert(to_regclass('public.cotizaciones_pricing_solicitud_idx') IS NOT DISTINCT FROM v_oid
    AND pg_catalog.pg_get_indexdef(v_oid, 0, false) = v_definition,
    'compatible index changed after rejected preflight');
  EXECUTE v_postcheck;
  DROP INDEX public.cotizaciones_pricing_solicitud_idx;
  RAISE NOTICE 'PASS pricing index guard: compatible preexisting index rejected';

  -- 3. Same table and column, but missing the required partial predicate.
  CREATE INDEX cotizaciones_pricing_solicitud_idx ON public.cotizaciones(pricing_solicitud_id);
  v_oid := 'public.cotizaciones_pricing_solicitud_idx'::regclass;
  v_definition := pg_catalog.pg_get_indexdef(v_oid, 0, false);
  PERFORM pg_temp.expect_pricing_index_drift(v_preflight, 'incompatible preexisting index preflight');
  PERFORM pg_temp.expect_pricing_index_drift(v_postcheck, 'incompatible preexisting index postcheck');
  PERFORM pg_temp.assert(to_regclass('public.cotizaciones_pricing_solicitud_idx') IS NOT DISTINCT FROM v_oid
    AND pg_catalog.pg_get_indexdef(v_oid, 0, false) = v_definition,
    'incompatible index changed after rejection');
  DROP INDEX public.cotizaciones_pricing_solicitud_idx;
  RAISE NOTICE 'PASS pricing index guard: incompatible preexisting index rejected';

  -- 4. An identically named ordinary table is a relation-name collision too.
  CREATE TABLE public.cotizaciones_pricing_solicitud_idx (test_only integer);
  v_oid := 'public.cotizaciones_pricing_solicitud_idx'::regclass;
  PERFORM pg_temp.expect_pricing_index_drift(v_preflight, 'preexisting homonymous table preflight');
  PERFORM pg_temp.expect_pricing_index_drift(v_postcheck, 'preexisting homonymous table postcheck');
  PERFORM pg_temp.assert(to_regclass('public.cotizaciones_pricing_solicitud_idx') IS NOT DISTINCT FROM v_oid
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = v_oid AND relkind = 'r'),
    'homonymous table changed after rejection');
  DROP TABLE public.cotizaciones_pricing_solicitud_idx;
  RAISE NOTICE 'PASS pricing index guard: preexisting homonymous table rejected';

  -- 5. Deterministic single-session interposition AFTER successful preflight.
  -- This simulates the wrong-object state at CREATE, not two-session timing,
  -- MVCC visibility, lock waiting, or any real concurrent installer guarantee.
  EXECUTE v_preflight;
  CREATE TABLE public.cotizaciones_pricing_solicitud_idx (test_only integer);
  v_oid := 'public.cotizaciones_pricing_solicitud_idx'::regclass;
  EXECUTE v_create; -- Must return via IF NOT EXISTS, leaving the wrong object.
  PERFORM pg_temp.assert(to_regclass('public.cotizaciones_pricing_solicitud_idx') IS NOT DISTINCT FROM v_oid
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = v_oid AND relkind = 'r')
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index WHERE indexrelid = v_oid),
    'controlled IF NOT EXISTS skip must preserve the wrong table');
  PERFORM pg_temp.expect_pricing_index_drift(v_postcheck, 'postcheck after controlled wrong-object skip');
  PERFORM pg_temp.assert(to_regclass('public.cotizaciones_pricing_solicitud_idx') IS NOT DISTINCT FROM v_oid,
    'rejected postcheck must preserve the interposed table');
  DROP TABLE public.cotizaciones_pricing_solicitud_idx;
  RAISE NOTICE 'PASS pricing index guard: controlled wrong-object skip rejected (not real concurrency)';
END;
$exercise_index_contract$;

ROLLBACK TO SAVEPOINT pricing_lineage_index_cases;
RELEASE SAVEPOINT pricing_lineage_index_cases;
-- Explicit restoration evidence before the outer rollback (not just cleanup).
SELECT pg_temp.assert(
  EXISTS (
    SELECT 1 FROM pg_temp._pricing_lineage_index_before b
    JOIN pg_catalog.pg_class c ON c.oid = b.oid
    JOIN pg_catalog.pg_index i ON i.indexrelid = c.oid
    WHERE c.oid = to_regclass('public.cotizaciones_pricing_solicitud_idx')
      AND to_jsonb(c) = b.relation_catalog AND to_jsonb(i) = b.index_catalog
      AND pg_catalog.pg_get_indexdef(c.oid, 0, false) = b.definition
  ) AND to_regclass('public._pricing_lineage_index_saved') IS NULL,
  'original index OID, catalogs, definition, and name must be fully restored');
SELECT pg_temp.assert_max_skips(0);
ROLLBACK;
