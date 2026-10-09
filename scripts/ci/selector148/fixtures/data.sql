CREATE FUNCTION pg_temp.snapshot_data() RETURNS TABLE(table_name text,row_count bigint,rows_hash text) LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
 FOR r IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','auth') ORDER BY 1,2 LOOP
  RETURN QUERY EXECUTE format('SELECT %L::text,count(*),md5(coalesce(string_agg(row_to_json(t)::text,E''\n'' ORDER BY row_to_json(t)::text),'''')) FROM %I.%I t',r.schemaname||'.'||r.tablename,r.schemaname,r.tablename);
 END LOOP;
END $$;
SELECT jsonb_pretty(jsonb_agg(to_jsonb(q) ORDER BY table_name)) FROM pg_temp.snapshot_data() q;
