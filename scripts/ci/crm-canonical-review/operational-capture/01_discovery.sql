-- One SELECT. Discovery only; returned values and generated follow-up SQL stay private.
WITH
db AS MATERIALIZED (
 SELECT d.oid, d.datname, d.datdba FROM pg_catalog.pg_database d
 WHERE d.datname = pg_catalog.current_database()
),
roots(label, name) AS (
 VALUES ('crm','public.crm_empresas'),
        ('drizzle','drizzle.__drizzle_migrations'),
        ('supabase','supabase_migrations.schema_migrations')
),
rels AS MATERIALIZED (
 SELECT r.label, r.name, pg_catalog.to_regclass(r.name)::oid AS oid FROM roots r
),
seq AS MATERIALIZED (
 SELECT c.oid, n.nspname, c.relname, c.relowner,
        pg_catalog.format('%I.%I',n.nspname,c.relname) AS qualified_name
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE c.oid=pg_catalog.to_regclass(CASE WHEN EXISTS (
   SELECT 1 FROM pg_catalog.pg_attribute a
   WHERE a.attrelid=pg_catalog.to_regclass('drizzle.__drizzle_migrations') AND a.attname='id' AND NOT a.attisdropped)
   THEN pg_catalog.pg_get_serial_sequence('drizzle.__drizzle_migrations','id') END)
),
role_seeds AS (
 SELECT r.* FROM pg_catalog.pg_roles r
 WHERE r.rolname IN (CURRENT_USER,SESSION_USER,'postgres','anon','authenticated','service_role','pg_read_all_stats')
)
SELECT pg_catalog.jsonb_build_object(
 'kind','crm-operational-evidence-v1','section','discovery','admission','NOT_ADMITTED',
 'capture',pg_catalog.jsonb_build_object(
   'captured_at',pg_catalog.clock_timestamp(),'statement_at',pg_catalog.statement_timestamp(),
   'database',pg_catalog.current_database(),'database_oid',(SELECT oid::text FROM db),
   'backend_pid',pg_catalog.pg_backend_pid(),'snapshot',pg_catalog.pg_current_snapshot()::text,
   'xid_if_assigned',pg_catalog.pg_current_xact_id_if_assigned()::text,
   'user',CURRENT_USER,'session_user',SESSION_USER),
 'result',pg_catalog.jsonb_build_object(
   'context',pg_catalog.jsonb_build_object(
      'server_version_num',pg_catalog.current_setting('server_version_num'),
      'server_encoding',pg_catalog.current_setting('server_encoding'),
      'client_encoding',pg_catalog.current_setting('client_encoding'),
      'isolation',pg_catalog.current_setting('transaction_isolation'),
      'transaction_read_only',pg_catalog.current_setting('transaction_read_only'),
      'row_security',pg_catalog.current_setting('row_security'),
      'session_replication_role',pg_catalog.current_setting('session_replication_role'),
      'statement_timeout',pg_catalog.current_setting('statement_timeout'),
      'lock_timeout',pg_catalog.current_setting('lock_timeout'),
      'search_path',pg_catalog.current_setting('search_path'),
      'in_recovery',pg_catalog.pg_is_in_recovery(),
      'read_all_stats_effective',pg_catalog.pg_has_role(CURRENT_USER,'pg_read_all_stats','USAGE')),
   'roles',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'oid',r.oid::text,'name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,
       'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'can_login',r.rolcanlogin,
       'replication',r.rolreplication,'bypass_rls',r.rolbypassrls,
       'current_member',pg_catalog.pg_has_role(CURRENT_USER,r.oid,'MEMBER'),
       'current_usage',pg_catalog.pg_has_role(CURRENT_USER,r.oid,'USAGE'),
       'current_can_set',pg_catalog.pg_has_role(CURRENT_USER,r.oid,'SET')) ORDER BY r.oid) FROM role_seeds r),
   'relations',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'label',r.label,'requested_name',r.name,'oid',r.oid::text,
       'relkind',c.relkind,'owner',c.relowner::text,'access_method_oid',c.relam::text,
       'is_partition',c.relispartition,'row_security',c.relrowsecurity,'force_row_security',c.relforcerowsecurity,
       'has_rules',c.relhasrules,'has_triggers',c.relhastriggers,
       'inheritance_links',(SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_inherits i WHERE i.inhparent=c.oid OR i.inhrelid=c.oid),
       'select',CASE WHEN r.oid IS NOT NULL THEN pg_catalog.has_table_privilege(CURRENT_USER,r.oid,'SELECT') END,
       'insert',CASE WHEN r.oid IS NOT NULL THEN pg_catalog.has_table_privilege(CURRENT_USER,r.oid,'INSERT') END,
       'update',CASE WHEN r.oid IS NOT NULL THEN pg_catalog.has_table_privilege(CURRENT_USER,r.oid,'UPDATE') END,
       'delete',CASE WHEN r.oid IS NOT NULL THEN pg_catalog.has_table_privilege(CURRENT_USER,r.oid,'DELETE') END,
       'truncate',CASE WHEN r.oid IS NOT NULL THEN pg_catalog.has_table_privilege(CURRENT_USER,r.oid,'TRUNCATE') END,
       'owner_usage',CASE WHEN c.relowner IS NOT NULL THEN pg_catalog.pg_has_role(CURRENT_USER,c.relowner,'USAGE') END,
       'columns',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'number',a.attnum,'name',a.attname,'type_oid',a.atttypid::text,
          'type_schema',tn.nspname,'type_name',t.typname,'type_kind',t.typtype,
          'dropped',a.attisdropped,'not_null',a.attnotnull,
          'identity',a.attidentity,'generated',a.attgenerated,'has_default',a.atthasdef,
          'has_missing',a.atthasmissing) ORDER BY a.attnum)
        FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
        LEFT JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace
        WHERE a.attrelid=r.oid AND a.attnum>0)) ORDER BY r.label)
     FROM rels r LEFT JOIN pg_catalog.pg_class c ON c.oid=r.oid),
   'helpers',(SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'oid',p.oid::text,'name',p.proname,'namespace',p.pronamespace::text,
       'owner',p.proowner::text,'kind',p.prokind,'argument_count',p.pronargs,
       'argument_type_oids',p.proargtypes::oid[],'return_type_oid',p.prorettype::text)
       ORDER BY p.oid)
     FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico')),
   'sequence',(SELECT pg_catalog.jsonb_build_object(
       'oid',s.oid::text,'name',s.qualified_name,'owner',s.relowner::text,
       'select',pg_catalog.has_sequence_privilege(CURRENT_USER,s.oid,'SELECT'),
       'usage',pg_catalog.has_sequence_privilege(CURRENT_USER,s.oid,'USAGE'),
       'update',pg_catalog.has_sequence_privilege(CURRENT_USER,s.oid,'UPDATE'),
       'state_select',pg_catalog.format(
         'SELECT pg_catalog.jsonb_build_object(''kind'',''crm-operational-evidence-v1'',''section'',''sequence_state'',''admission'',''NOT_ADMITTED'',''capture'',pg_catalog.jsonb_build_object(''captured_at'',pg_catalog.clock_timestamp(),''statement_at'',pg_catalog.statement_timestamp(),''database'',pg_catalog.current_database(),''database_oid'',(SELECT oid::text FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()),''backend_pid'',pg_catalog.pg_backend_pid(),''snapshot'',pg_catalog.pg_current_snapshot()::text,''xid_if_assigned'',pg_catalog.pg_current_xact_id_if_assigned()::text,''user'',CURRENT_USER,''session_user'',SESSION_USER),''result'',pg_catalog.jsonb_build_object(''sequence_name'',%L,''expected_sequence_oid'',%L,''identity_matches'',pg_catalog.to_regclass(%L)::oid=%L::oid AND (SELECT oid::text FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())=%L,''sequence_state'',pg_catalog.jsonb_build_object(''last_value'',last_value::text,''is_called'',is_called))) AS crm_evidence FROM %I.%I;',
         s.qualified_name,s.oid::text,s.qualified_name,s.oid::text,(SELECT oid::text FROM db),s.nspname,s.relname)) FROM seq s),
   'transport_properties','UNKNOWN_REQUIRES_PARENT_VERIFICATION')) AS crm_evidence;
