-- One SELECT. Change only offset_value to the previous result's next_offset.
WITH
params AS (SELECT 0::bigint AS offset_value,100::bigint AS page_size),
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
),
numbered AS MATERIALIZED (
 SELECT f.*,pg_catalog.row_number() OVER (ORDER BY version COLLATE pg_catalog."C",row_sha256) AS row_number FROM fingerprints f
),
manifest AS MATERIALIZED (
 SELECT pg_catalog.count(*) AS row_count,
   pg_catalog.count(*) FILTER (WHERE version IS NULL) AS null_versions,
   pg_catalog.count(version)-pg_catalog.count(DISTINCT version) AS duplicate_versions,
   pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
     coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(version,row_sha256) ORDER BY version COLLATE pg_catalog."C",row_sha256),'[]'::pg_catalog.jsonb)::text,'UTF8')),'hex') AS history_sha256
 FROM fingerprints
)
SELECT pg_catalog.jsonb_build_object(
 'kind','crm-operational-evidence-v1','section','supabase_page','admission','NOT_ADMITTED',
 'capture',pg_catalog.jsonb_build_object(
   'captured_at',pg_catalog.clock_timestamp(),'statement_at',pg_catalog.statement_timestamp(),
   'database',pg_catalog.current_database(),'database_oid',(SELECT oid::text FROM db),
   'backend_pid',pg_catalog.pg_backend_pid(),'snapshot',pg_catalog.pg_current_snapshot()::text,
   'xid_if_assigned',pg_catalog.pg_current_xact_id_if_assigned()::text,'user',CURRENT_USER,'session_user',SESSION_USER,
   'format_settings',pg_catalog.jsonb_build_object('TimeZone',pg_catalog.current_setting('TimeZone'),'DateStyle',pg_catalog.current_setting('DateStyle'),'IntervalStyle',pg_catalog.current_setting('IntervalStyle'),'bytea_output',pg_catalog.current_setting('bytea_output'),'extra_float_digits',pg_catalog.current_setting('extra_float_digits'))),
 'result',pg_catalog.jsonb_build_object(
   'shape_supported',(SELECT supported FROM shape),
   'status',CASE WHEN (SELECT supported FROM shape) THEN 'CAPTURE_ONLY' ELSE 'BLOCKED_UNSUPPORTED_LEDGER_COLUMNS' END,
   'offset',p.offset_value::text,'page_size',p.page_size::text,
   'row_count',CASE WHEN (SELECT supported FROM shape) THEN m.row_count::text END,
   'history_sha256',CASE WHEN (SELECT supported FROM shape) THEN m.history_sha256 END,
   'null_versions',CASE WHEN (SELECT supported FROM shape) THEN m.null_versions::text END,
   'duplicate_versions',CASE WHEN (SELECT supported FROM shape) THEN m.duplicate_versions::text END,
   'page_rows',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'row_number',n.row_number::text,
       'version',CASE WHEN n.version ~ '^[0-9]{1,32}$' THEN n.version END,
       'version_is_numeric',coalesce(n.version ~ '^[0-9]{1,32}$',false),
       'version_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(n.version,'<NULL>'),'UTF8')),'hex'),
       'row_sha256',n.row_sha256) ORDER BY n.row_number)
     FROM numbered n WHERE n.row_number>p.offset_value AND n.row_number<=p.offset_value+p.page_size),'[]'::pg_catalog.jsonb),
   'has_more',(SELECT supported FROM shape) AND m.row_count>p.offset_value+p.page_size,
   'next_offset',CASE WHEN (SELECT supported FROM shape) AND m.row_count>p.offset_value+p.page_size THEN (p.offset_value+p.page_size)::text END)) AS crm_evidence
FROM params p CROSS JOIN manifest m;
