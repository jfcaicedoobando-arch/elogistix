
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT (polrelid::regclass)::text AS tbl, polname
      FROM pg_policy
     WHERE polname ILIKE 'Hide soft deleted%'
       AND pg_get_expr(polwithcheck, polrelid) = '(deleted_at IS NULL)'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %s WITH CHECK (true)',
      r.polname, r.tbl
    );
  END LOOP;
END $$;
