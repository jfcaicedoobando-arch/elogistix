-- One SELECT. Full-row commitments, never statement text or other stored values.
WITH
db AS MATERIALIZED (SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()),
shape AS MATERIALIZED (
 SELECT coalesce(pg_catalog.bool_and(a.atttypid=ANY(ARRAY[16,17,18,19,20,21,23,25,26,700,701,1042,1043,1082,1083,1114,1184,1186,1266,1700,2950,114,3802,1009]::pg_catalog.oid[])
   AND NOT a.attisdropped),false)
   AND pg_catalog.count(*) FILTER (WHERE a.attname='version' AND a.atttypid=25)=1 AS supported
 FROM pg_catalog.pg_attribute a WHERE a.attrelid='supabase_migrations.schema_migrations'::pg_catalog.regclass AND a.attnum>0
),
fingerprints AS MATERIALIZED (
 SELECT s.version COLLATE pg_catalog."C" AS version,
   pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.to_jsonb(s)::text,'UTF8')),'hex') AS row_sha256
 FROM supabase_migrations.schema_migrations s WHERE (SELECT supported FROM shape)
)
SELECT pg_catalog.jsonb_build_object(
 'kind','crm-operational-evidence-v1','section','supabase_manifest','admission','NOT_ADMITTED',
 'capture',pg_catalog.jsonb_build_object(
   'captured_at',pg_catalog.clock_timestamp(),'statement_at',pg_catalog.statement_timestamp(),
   'database',pg_catalog.current_database(),'database_oid',(SELECT oid::text FROM db),
   'backend_pid',pg_catalog.pg_backend_pid(),'snapshot',pg_catalog.pg_current_snapshot()::text,
   'xid_if_assigned',pg_catalog.pg_current_xact_id_if_assigned()::text,'user',CURRENT_USER,'session_user',SESSION_USER,
   'format_settings',pg_catalog.jsonb_build_object('TimeZone',pg_catalog.current_setting('TimeZone'),'DateStyle',pg_catalog.current_setting('DateStyle'),'IntervalStyle',pg_catalog.current_setting('IntervalStyle'),'bytea_output',pg_catalog.current_setting('bytea_output'),'extra_float_digits',pg_catalog.current_setting('extra_float_digits'))),
 'result',pg_catalog.jsonb_build_object(
   'shape_supported',(SELECT supported FROM shape),
   'status',CASE WHEN (SELECT supported FROM shape) THEN 'CAPTURE_ONLY' ELSE 'BLOCKED_UNSUPPORTED_LEDGER_COLUMNS' END,
   'row_count',CASE WHEN (SELECT supported FROM shape) THEN (SELECT pg_catalog.count(*)::text FROM fingerprints) END,
   'null_versions',CASE WHEN (SELECT supported FROM shape) THEN (SELECT pg_catalog.count(*) FILTER (WHERE version IS NULL)::text FROM fingerprints) END,
   'duplicate_versions',CASE WHEN (SELECT supported FROM shape) THEN (SELECT (pg_catalog.count(version)-pg_catalog.count(DISTINCT version))::text FROM fingerprints) END,
   'history_sha256',CASE WHEN (SELECT supported FROM shape) THEN (
     SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
       coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(version,row_sha256) ORDER BY version COLLATE pg_catalog."C",row_sha256),'[]'::pg_catalog.jsonb)::text,'UTF8')),'hex') FROM fingerprints) END)) AS crm_evidence;
