-- One SELECT. Only the migration ledger, with a strict builtin-column gate.
WITH
db AS MATERIALIZED (SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()),
shape AS MATERIALIZED (
 SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.attname,a.atttypid::text)
   ORDER BY a.attnum) FILTER (WHERE a.attnum>0),'[]'::pg_catalog.jsonb)
     = '[ ["id","23"], ["hash","25"], ["created_at","20"] ]'::pg_catalog.jsonb
   AND coalesce(pg_catalog.bool_and(NOT a.attisdropped AND a.attidentity='' AND a.attgenerated='')
     FILTER (WHERE a.attnum>0),false) AS supported
 FROM pg_catalog.pg_attribute a WHERE a.attrelid='drizzle.__drizzle_migrations'::pg_catalog.regclass
)
SELECT pg_catalog.jsonb_build_object(
 'kind','crm-operational-evidence-v1','section','drizzle_history','admission','NOT_ADMITTED',
 'capture',pg_catalog.jsonb_build_object(
   'captured_at',pg_catalog.clock_timestamp(),'statement_at',pg_catalog.statement_timestamp(),
   'database',pg_catalog.current_database(),'database_oid',(SELECT oid::text FROM db),
   'backend_pid',pg_catalog.pg_backend_pid(),'snapshot',pg_catalog.pg_current_snapshot()::text,
   'xid_if_assigned',pg_catalog.pg_current_xact_id_if_assigned()::text,'user',CURRENT_USER,'session_user',SESSION_USER),
 'result',CASE WHEN (SELECT supported FROM shape) THEN (
   SELECT pg_catalog.jsonb_build_object(
     'shape_supported',true,'row_count',pg_catalog.count(*)::text,
     'rows',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'id',d.id::text,'hash',CASE WHEN d.hash ~ '^[0-9a-f]{64}$' THEN d.hash END,
       'hash_is_canonical_format',coalesce(d.hash ~ '^[0-9a-f]{64}$',false),
       'hash_value_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(d.hash,'<NULL>'),'UTF8')),'hex'),
       'created_at',d.created_at::text,
       'row_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.to_jsonb(d)::text,'UTF8')),'hex'))
       ORDER BY d.id),'[]'::pg_catalog.jsonb),
     'history_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
       coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY d.id),'[]'::pg_catalog.jsonb)::text,'UTF8')),'hex'),
     'null_id_count',pg_catalog.count(*) FILTER (WHERE d.id IS NULL)::text,
     'null_hash_count',pg_catalog.count(*) FILTER (WHERE d.hash IS NULL)::text,
     'null_created_at_count',pg_catalog.count(*) FILTER (WHERE d.created_at IS NULL)::text,
     'duplicate_ids',(pg_catalog.count(d.id)-pg_catalog.count(DISTINCT d.id))::text,
     'duplicate_hashes',(pg_catalog.count(d.hash)-pg_catalog.count(DISTINCT d.hash))::text,
     'duplicate_timestamps',(pg_catalog.count(d.created_at)-pg_catalog.count(DISTINCT d.created_at))::text)
   FROM drizzle.__drizzle_migrations d)
   ELSE pg_catalog.jsonb_build_object('shape_supported',false,'status','BLOCKED_UNSUPPORTED_LEDGER_COLUMNS') END) AS crm_evidence;
