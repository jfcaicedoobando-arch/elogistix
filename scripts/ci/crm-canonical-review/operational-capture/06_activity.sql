-- One SELECT. Operational metadata only; no query text, addresses, GID text or connection settings.
WITH
db AS MATERIALIZED (SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()),
visibility AS MATERIALIZED (
 SELECT r.oid AS current_role_oid,r.rolsuper,
   r.rolsuper OR pg_catalog.pg_has_role(CURRENT_USER,'pg_read_all_stats','USAGE') AS all_stats
 FROM pg_catalog.pg_roles r WHERE r.rolname=CURRENT_USER
),
sessions AS MATERIALIZED (
 SELECT a.pid,a.usesysid,a.backend_start,a.xact_start,a.query_start,a.state_change,
   a.state,a.backend_type,a.wait_event_type,a.wait_event,a.backend_xid,a.backend_xmin,
   (SELECT all_stats FROM visibility) OR a.usesysid=(SELECT current_role_oid FROM visibility)
     OR coalesce(pg_catalog.pg_has_role(CURRENT_USER,a.usesysid,'USAGE'),false) AS role_visible
 FROM pg_catalog.pg_stat_activity a WHERE a.datid=(SELECT oid FROM db)
),
prepared AS MATERIALIZED (
 SELECT p.transaction,p.prepared,p.owner,p.database,
   pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.gid,'UTF8')),'hex') AS gid_sha256
 FROM pg_catalog.pg_prepared_xacts p WHERE p.database=pg_catalog.current_database()
),
roots AS MATERIALIZED (
 SELECT pg_catalog.to_regclass(v.name)::oid AS oid FROM
 (VALUES ('public.crm_empresas'),('drizzle.__drizzle_migrations'),('supabase_migrations.schema_migrations')) v(name)
),
helpers AS MATERIALIZED (
 SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico')
),
locks AS MATERIALIZED (
 SELECT l.* FROM pg_catalog.pg_locks l WHERE
   (l.database=(SELECT oid FROM db) AND (l.relation IN (SELECT oid FROM roots)
     OR (l.classid='pg_catalog.pg_proc'::pg_catalog.regclass AND l.objid IN (SELECT oid FROM helpers))))
   OR l.pid IN (SELECT pid FROM sessions)
   OR (l.locktype='transactionid' AND l.transactionid IN (SELECT transaction FROM prepared))
),
subscriptions AS MATERIALIZED (
 SELECT s.oid,s.subowner,s.subenabled FROM pg_catalog.pg_subscription s WHERE s.subdbid=(SELECT oid FROM db)
),
subscription_workers AS MATERIALIZED (
 SELECT s.subid,s.pid,s.relid FROM pg_catalog.pg_stat_subscription s WHERE s.subid IN (SELECT oid FROM subscriptions)
)
SELECT pg_catalog.jsonb_build_object(
 'kind','crm-operational-evidence-v1','section','activity','admission','NOT_ADMITTED',
 'capture',pg_catalog.jsonb_build_object(
   'captured_at',pg_catalog.clock_timestamp(),'statement_at',pg_catalog.statement_timestamp(),
   'database',pg_catalog.current_database(),'database_oid',(SELECT oid::text FROM db),
   'backend_pid',pg_catalog.pg_backend_pid(),'snapshot',pg_catalog.pg_current_snapshot()::text,
   'xid_if_assigned',pg_catalog.pg_current_xact_id_if_assigned()::text,'user',CURRENT_USER,'session_user',SESSION_USER),
 'result',pg_catalog.jsonb_build_object(
   'statistics_visibility',CASE WHEN (SELECT all_stats FROM visibility)
     THEN 'PRIVILEGE_PRESENT_DETAILS_MUST_BE_CHECKED' ELSE 'RESTRICTED_OR_ROLE_SCOPED' END,
   'details_available_for_all_observed_sessions',(SELECT coalesce(pg_catalog.bool_and(coalesce(role_visible,false) AND state IS NOT NULL AND state<>'disabled'),false) FROM sessions),
   'read_all_stats_effective',(SELECT all_stats FROM visibility),
   'track_activities',pg_catalog.current_setting('track_activities'),
   'max_prepared_transactions',pg_catalog.current_setting('max_prepared_transactions'),
   'other_session_count',(SELECT pg_catalog.count(*) FILTER (WHERE pid<>pg_catalog.pg_backend_pid())::text FROM sessions),
   'sessions',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'pid',s.pid,'role_oid',s.usesysid::text,'is_capture_backend',s.pid=pg_catalog.pg_backend_pid(),
      'backend_start',s.backend_start,'xact_start',s.xact_start,'query_start',s.query_start,
      'state_change',s.state_change,'state',s.state,'backend_type',s.backend_type,
      'wait_event_type',s.wait_event_type,'wait_event',s.wait_event,
      'backend_xid',s.backend_xid::text,'backend_xmin',s.backend_xmin::text,
      'role_visibility_verified',coalesce(s.role_visible,false),
      'blocking_pids',pg_catalog.pg_blocking_pids(s.pid)) ORDER BY s.pid) FROM sessions s),'[]'::pg_catalog.jsonb),
   'prepared_count',(SELECT pg_catalog.count(*)::text FROM prepared),
   'prepared',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'transaction',p.transaction::text,'prepared_at',p.prepared,'owner',p.owner,
      'database',p.database,'gid_sha256',p.gid_sha256) ORDER BY p.prepared,p.gid_sha256) FROM prepared p),'[]'::pg_catalog.jsonb),
   'locks',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l)
      ORDER BY l.pid NULLS LAST,l.locktype,l.database,l.relation,l.classid,l.objid,l.objsubid,l.mode,l.granted) FROM locks l),'[]'::pg_catalog.jsonb),
   'subscriptions',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'oid',s.oid::text,'owner_oid',s.subowner::text,'enabled',s.subenabled) ORDER BY s.oid) FROM subscriptions s),'[]'::pg_catalog.jsonb),
   'subscription_workers',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'subscription_oid',s.subid::text,'pid',s.pid,'relation_oid',s.relid::text) ORDER BY s.subid,s.pid,s.relid) FROM subscription_workers s),'[]'::pg_catalog.jsonb),
   'external_queues_pre_readers_owner_ddl_acl_window','UNKNOWN_REQUIRES_EXTERNAL_COORDINATION',
   'transport_commit_session_registration_retry_properties','UNKNOWN_REQUIRES_PARENT_VERIFICATION')) AS crm_evidence;
