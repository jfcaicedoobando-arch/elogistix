-- Executes both actual legacy lookup statements from the installed core against
-- synthetic UUID rows. Temp fixtures only; no quotation/shipment business data.
BEGIN;
CREATE TEMP TABLE conversion_uuid_ports(id uuid PRIMARY KEY, code text);
INSERT INTO conversion_uuid_ports VALUES
  ('10000000-0000-0000-0000-000000000001', ' MXVER '),
  ('10000000-0000-0000-0000-000000000002', 'CNSHA'),
  ('10000000-0000-0000-0000-000000000003', 'DUP'),
  ('10000000-0000-0000-0000-000000000004', ' dup ');

DO $test$
DECLARE
  source text := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);
  statement text;
  lookup text;
  actual uuid;
  expected uuid;
  direction text;
  candidate text;
  tested integer := 0;
BEGIN
  FOREACH direction IN ARRAY ARRAY['o', 'd'] LOOP
    -- Extract production SQL, not a reimplementation of its aggregate.
    statement := substring(source FROM
      'SELECT [^;]+ INTO v_puerto_' || direction || '_id[[:space:]]+FROM public\.puertos p[^;]+HAVING count\(\*\) = 1;');
    IF statement IS NULL THEN
      RAISE EXCEPTION 'Legacy lookup % missing or unique-match guard changed', direction;
    END IF;
    statement := replace(statement, ' INTO v_puerto_' || direction || '_id', '');
    statement := replace(statement, 'public.puertos', 'pg_temp.conversion_uuid_ports');
    statement := replace(statement, CASE direction WHEN 'o' THEN 'v_origen_code' ELSE 'v_destino_code' END, '$1');
    FOREACH candidate IN ARRAY ARRAY['mxver', ' CNSHA ', 'MISSING', 'DUP', 'MXVE'] LOOP
      expected := CASE btrim(upper(candidate))
        WHEN 'MXVER' THEN '10000000-0000-0000-0000-000000000001'::uuid
        WHEN 'CNSHA' THEN '10000000-0000-0000-0000-000000000002'::uuid
        ELSE NULL::uuid END;
      -- Start with a sentinel, verifying zero/ambiguous results clear it.
      actual := 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid;
      EXECUTE statement INTO actual USING candidate;
      IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'lookup % (%) returned %, expected %', direction, candidate, actual, expected;
      END IF;
      tested := tested + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'PASS: % actual UUID port lookups (both directions; unique, absent, ambiguous, exact match)', tested;
END;
$test$;
ROLLBACK;
