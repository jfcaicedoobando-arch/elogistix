-- One SELECT. Catalog metadata only; no application relation is scanned.
WITH RECURSIVE
db AS MATERIALIZED (
 SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()
),
roots AS MATERIALIZED (
 SELECT pg_catalog.to_regclass(x.name)::oid AS oid FROM
 (VALUES ('public.crm_empresas'),('drizzle.__drizzle_migrations'),('supabase_migrations.schema_migrations')) x(name)
),
helpers AS MATERIALIZED (
 SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico')
),
base_rels AS MATERIALIZED (
 SELECT oid FROM roots WHERE oid IS NOT NULL
 UNION SELECT tgrelid FROM pg_catalog.pg_trigger WHERE tgfoid IN (SELECT oid FROM helpers)
),
base_defaults AS MATERIALIZED (
 SELECT d.* FROM pg_catalog.pg_attrdef d WHERE d.adrelid IN (SELECT oid FROM base_rels)
),
relation_bases AS MATERIALIZED (
 SELECT oid FROM base_rels
 UNION SELECT c.reltoastrelid FROM pg_catalog.pg_class c WHERE c.oid IN (SELECT oid FROM base_rels) AND c.reltoastrelid<>0
 UNION SELECT c.oid FROM pg_catalog.pg_class c WHERE c.relkind='S' AND EXISTS (
   SELECT 1 FROM pg_catalog.pg_depend d WHERE
    (d.classid='pg_catalog.pg_class'::pg_catalog.regclass AND d.objid=c.oid
      AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid IN (SELECT oid FROM base_rels))
    OR (d.classid='pg_catalog.pg_attrdef'::pg_catalog.regclass AND d.objid IN (SELECT oid FROM base_defaults)
      AND d.refclassid='pg_catalog.pg_class'::pg_catalog.regclass AND d.refobjid=c.oid))
),
rels AS MATERIALIZED (
 SELECT oid FROM relation_bases
 UNION SELECT indexrelid FROM pg_catalog.pg_index WHERE indrelid IN (SELECT oid FROM relation_bases)
),
trigs AS MATERIALIZED (
 SELECT t.* FROM pg_catalog.pg_trigger t WHERE t.tgrelid IN (SELECT oid FROM rels) OR t.tgfoid IN (SELECT oid FROM helpers)
),
events AS MATERIALIZED (SELECT e.* FROM pg_catalog.pg_event_trigger e),
funcs AS MATERIALIZED (
 SELECT p.* FROM pg_catalog.pg_proc p WHERE p.oid IN (
   SELECT oid FROM helpers UNION SELECT tgfoid FROM trigs UNION SELECT evtfoid FROM events)
),
attrs AS MATERIALIZED (SELECT a.* FROM pg_catalog.pg_attribute a WHERE a.attrelid IN (SELECT oid FROM rels)),
defs AS MATERIALIZED (SELECT d.* FROM pg_catalog.pg_attrdef d WHERE d.adrelid IN (SELECT oid FROM rels)),
cons AS MATERIALIZED (
 SELECT c.* FROM pg_catalog.pg_constraint c WHERE c.conrelid IN (SELECT oid FROM rels) OR c.confrelid IN (SELECT oid FROM rels)
),
idx AS MATERIALIZED (SELECT i.* FROM pg_catalog.pg_index i WHERE i.indrelid IN (SELECT oid FROM rels)),
pols AS MATERIALIZED (SELECT p.* FROM pg_catalog.pg_policy p WHERE p.polrelid IN (SELECT oid FROM rels)),
rules AS MATERIALIZED (SELECT r.* FROM pg_catalog.pg_rewrite r WHERE r.ev_class IN (SELECT oid FROM rels)),
types AS MATERIALIZED (
 SELECT t.* FROM pg_catalog.pg_type t WHERE t.oid IN (
   SELECT atttypid FROM attrs UNION SELECT prorettype FROM funcs
   UNION SELECT pg_catalog.unnest(proargtypes::pg_catalog.oid[]) FROM funcs)
),
namespaces AS MATERIALIZED (
 SELECT n.* FROM pg_catalog.pg_namespace n WHERE n.oid IN (
   SELECT relnamespace FROM pg_catalog.pg_class WHERE oid IN (SELECT oid FROM rels)
   UNION SELECT pronamespace FROM funcs UNION SELECT typnamespace FROM types)
),
addresses(classid,objid) AS MATERIALIZED (
 SELECT 'pg_catalog.pg_class'::pg_catalog.regclass::pg_catalog.oid,oid FROM rels
 UNION SELECT 'pg_catalog.pg_proc'::pg_catalog.regclass::pg_catalog.oid,oid FROM funcs
 UNION SELECT 'pg_catalog.pg_attrdef'::pg_catalog.regclass::pg_catalog.oid,oid FROM defs
 UNION SELECT 'pg_catalog.pg_constraint'::pg_catalog.regclass::pg_catalog.oid,oid FROM cons
 UNION SELECT 'pg_catalog.pg_trigger'::pg_catalog.regclass::pg_catalog.oid,oid FROM trigs
 UNION SELECT 'pg_catalog.pg_policy'::pg_catalog.regclass::pg_catalog.oid,oid FROM pols
 UNION SELECT 'pg_catalog.pg_rewrite'::pg_catalog.regclass::pg_catalog.oid,oid FROM rules
 UNION SELECT 'pg_catalog.pg_type'::pg_catalog.regclass::pg_catalog.oid,oid FROM types
 UNION SELECT 'pg_catalog.pg_event_trigger'::pg_catalog.regclass::pg_catalog.oid,oid FROM events
 UNION SELECT 'pg_catalog.pg_namespace'::pg_catalog.regclass::pg_catalog.oid,oid FROM namespaces
),
sdeps AS MATERIALIZED (
 SELECT d.* FROM pg_catalog.pg_shdepend d WHERE d.dbid IN (0,(SELECT oid FROM db))
   AND EXISTS (SELECT 1 FROM addresses a WHERE a.classid=d.classid AND a.objid=d.objid)
),
role_seeds(oid) AS (
 SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN (CURRENT_USER,SESSION_USER,'postgres','anon','authenticated','service_role','pg_read_all_stats')
 UNION SELECT relowner FROM pg_catalog.pg_class WHERE oid IN (SELECT oid FROM rels)
 UNION SELECT proowner FROM funcs UNION SELECT nspowner FROM namespaces UNION SELECT evtowner FROM events
 UNION SELECT refobjid FROM sdeps WHERE refclassid='pg_catalog.pg_authid'::pg_catalog.regclass
),
role_closure(oid) AS (
 SELECT oid FROM role_seeds
 UNION
 SELECT CASE WHEN m.member=c.oid THEN m.roleid ELSE m.member END
 FROM pg_catalog.pg_auth_members m JOIN role_closure c ON m.member=c.oid OR m.roleid=c.oid
),
memberships AS MATERIALIZED (
 SELECT m.* FROM pg_catalog.pg_auth_members m WHERE m.member IN (SELECT oid FROM role_closure) OR m.roleid IN (SELECT oid FROM role_closure)
),
role_ids AS (SELECT oid FROM role_closure UNION SELECT grantor FROM memberships)
SELECT pg_catalog.jsonb_build_object(
 'kind','crm-operational-evidence-v1','section','catalog','admission','NOT_ADMITTED',
 'capture',pg_catalog.jsonb_build_object(
   'captured_at',pg_catalog.clock_timestamp(),'statement_at',pg_catalog.statement_timestamp(),
   'database',pg_catalog.current_database(),'database_oid',(SELECT oid::text FROM db),
   'backend_pid',pg_catalog.pg_backend_pid(),'snapshot',pg_catalog.pg_current_snapshot()::text,
   'xid_if_assigned',pg_catalog.pg_current_xact_id_if_assigned()::text,'user',CURRENT_USER,'session_user',SESSION_USER),
 'result',pg_catalog.jsonb_build_object(
 'relations',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid','reloptions','relpartbound'],
   'options_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(c.reloptions::text,'<NULL>'),'UTF8')),'hex'),
   'partition_bound_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(c.relpartbound::text,'<NULL>'),'UTF8')),'hex'),
   'partition_bound_is_null',c.relpartbound IS NULL,
   'qualified_name',pg_catalog.format('%I.%I',n.nspname,c.relname),
   'schema_usage',pg_catalog.has_schema_privilege(CURRENT_USER,n.oid,'USAGE')) ORDER BY c.oid)
   FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.oid IN (SELECT oid FROM rels)),'[]'::pg_catalog.jsonb),
 'namespaces',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(n) ORDER BY n.oid) FROM namespaces n),'[]'::pg_catalog.jsonb),
 'attributes',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.jsonb_build_object('attrelid',a.attrelid,'attname',a.attname,'atttypid',a.atttypid,
     'attstattarget',a.attstattarget,'attlen',a.attlen,'attnum',a.attnum,'attndims',a.attndims,
     'attcacheoff',a.attcacheoff,'atttypmod',a.atttypmod,'attbyval',a.attbyval,'attalign',a.attalign,
     'attstorage',a.attstorage,'attcompression',a.attcompression,'attnotnull',a.attnotnull,
     'atthasdef',a.atthasdef,'atthasmissing',a.atthasmissing,'attidentity',a.attidentity,
     'attgenerated',a.attgenerated,'attisdropped',a.attisdropped,'attislocal',a.attislocal,
     'attinhcount',a.attinhcount,'attcollation',a.attcollation,'attacl',a.attacl),
   'options_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(a.attoptions::text,'<NULL>'),'UTF8')),'hex'),
   'fdw_options_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(a.attfdwoptions::text,'<NULL>'),'UTF8')),'hex'),
   'missing_value_is_null',a.attmissingval IS NULL,
   'missing_value_fingerprint_supported',a.attmissingval IS NULL OR a.atttypid=ANY(ARRAY[16,17,18,19,20,21,23,25,26,700,701,1042,1043,1082,1083,1114,1184,1186,1266,1700,2950,114,3802]::pg_catalog.oid[]),
   'missing_value_sha256',CASE WHEN a.attmissingval IS NULL THEN NULL
     WHEN a.atttypid=ANY(ARRAY[16,17,18,19,20,21,23,25,26,700,701,1042,1043,1082,1083,1114,1184,1186,1266,1700,2950,114,3802]::pg_catalog.oid[])
     THEN pg_catalog.encode(pg_catalog.sha256(pg_catalog.array_send(a.attmissingval)),'hex') END)
   ORDER BY a.attrelid,a.attnum) FROM attrs a),'[]'::pg_catalog.jsonb),
 'functions',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(p)-ARRAY['prosrc','probin','prosqlbody','proargdefaults','proconfig'],
   'is_named_helper',p.oid IN (SELECT oid FROM helpers),
   'source_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex'),
   'binary_is_null',p.probin IS NULL,'binary_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(p.probin,'<NULL>'),'UTF8')),'hex'),
   'sql_body_is_null',p.prosqlbody IS NULL,'sql_body_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(p.prosqlbody::text,'<NULL>'),'UTF8')),'hex'),
   'argument_defaults_is_null',p.proargdefaults IS NULL,
   'argument_defaults_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(p.proargdefaults::text,'<NULL>'),'UTF8')),'hex'),
   'config_is_null',p.proconfig IS NULL,'config_is_expected_helper_value',p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=public']::text[],
   'config_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(p.proconfig::text,'<NULL>'),'UTF8')),'hex'),
   'acl_entries',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY x.grantor,x.grantee,x.privilege_type,x.is_grantable),'[]'::pg_catalog.jsonb)
     FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x),
   'effective_execute',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role_oid',r.oid::text,'role_name',r.rolname,
       'execute',pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE')) ORDER BY r.oid),'[]'::pg_catalog.jsonb)
     FROM pg_catalog.pg_roles r WHERE r.rolname IN ('postgres','anon','authenticated','service_role')))
   ORDER BY p.oid) FROM funcs p),'[]'::pg_catalog.jsonb),
 'triggers',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(t)-ARRAY['tgargs','tgqual'],
   'args_octets',pg_catalog.octet_length(t.tgargs),'args_sha256',pg_catalog.encode(pg_catalog.sha256(t.tgargs),'hex'),
   'when_is_null',t.tgqual IS NULL,'when_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(t.tgqual::text,'<NULL>'),'UTF8')),'hex'))
   ORDER BY t.oid) FROM trigs t),'[]'::pg_catalog.jsonb),
 'defaults',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(d)-'adbin',
   'tree_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.adbin::text,'UTF8')),'hex'),
   'references',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) ORDER BY x.classid,x.objid,x.objsubid,x.refclassid,x.refobjid,x.refobjsubid,x.deptype),'[]'::pg_catalog.jsonb)
     FROM pg_catalog.pg_depend x WHERE x.classid='pg_catalog.pg_attrdef'::pg_catalog.regclass AND x.objid=d.oid))
   ORDER BY d.oid) FROM defs d),'[]'::pg_catalog.jsonb),
 'constraints',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(c)-'conbin','expression_is_null',c.conbin IS NULL,
   'expression_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(c.conbin::text,'<NULL>'),'UTF8')),'hex'))
   ORDER BY c.oid) FROM cons c),'[]'::pg_catalog.jsonb),
 'indexes',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(i)-ARRAY['indexprs','indpred'],
   'expressions_is_null',i.indexprs IS NULL,'predicate_is_null',i.indpred IS NULL,
   'expressions_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(i.indexprs::text,'<NULL>'),'UTF8')),'hex'),
   'predicate_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(i.indpred::text,'<NULL>'),'UTF8')),'hex'))
   ORDER BY i.indexrelid) FROM idx i),'[]'::pg_catalog.jsonb),
 'policies',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(p)-ARRAY['polqual','polwithcheck'],
   'using_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(p.polqual::text,'<NULL>'),'UTF8')),'hex'),
   'check_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(p.polwithcheck::text,'<NULL>'),'UTF8')),'hex'))
   ORDER BY p.oid) FROM pols p),'[]'::pg_catalog.jsonb),
 'rules',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(r)-ARRAY['ev_action','ev_qual'],
   'action_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.ev_action::text,'UTF8')),'hex'),
   'condition_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r.ev_qual::text,'UTF8')),'hex'))
   ORDER BY r.oid) FROM rules r),'[]'::pg_catalog.jsonb),
 'inheritance',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) ORDER BY i.inhrelid,i.inhseqno) FROM pg_catalog.pg_inherits i
   WHERE i.inhparent IN (SELECT oid FROM rels) OR i.inhrelid IN (SELECT oid FROM rels)),'[]'::pg_catalog.jsonb),
 'types',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'metadata',pg_catalog.to_jsonb(t)-ARRAY['typdefault','typdefaultbin'],
   'default_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(t.typdefault,'<NULL>'),'UTF8')),'hex'),
   'default_tree_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(t.typdefaultbin::text,'<NULL>'),'UTF8')),'hex'))
   ORDER BY t.oid) FROM types t),'[]'::pg_catalog.jsonb),
 'languages',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) ORDER BY l.oid) FROM pg_catalog.pg_language l
   WHERE l.oid IN (SELECT prolang FROM funcs)),'[]'::pg_catalog.jsonb),
 'sequences',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'seqrelid',s.seqrelid::text,'seqtypid',s.seqtypid::text,'seqstart',s.seqstart::text,
   'seqincrement',s.seqincrement::text,'seqmax',s.seqmax::text,'seqmin',s.seqmin::text,
   'seqcache',s.seqcache::text,'seqcycle',s.seqcycle) ORDER BY s.seqrelid) FROM pg_catalog.pg_sequence s
   WHERE s.seqrelid IN (SELECT oid FROM rels)),'[]'::pg_catalog.jsonb),
 'operator_classes',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o) ORDER BY o.oid) FROM pg_catalog.pg_opclass o
   WHERE o.oid IN (SELECT pg_catalog.unnest(indclass::pg_catalog.oid[]) FROM idx)),'[]'::pg_catalog.jsonb),
 'operator_families',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(f) ORDER BY f.oid) FROM pg_catalog.pg_opfamily f
   WHERE f.oid IN (SELECT o.opcfamily FROM pg_catalog.pg_opclass o WHERE o.oid IN (SELECT pg_catalog.unnest(indclass::pg_catalog.oid[]) FROM idx))),'[]'::pg_catalog.jsonb),
 'access_methods',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a) ORDER BY a.oid) FROM pg_catalog.pg_am a
   WHERE a.oid IN (SELECT relam FROM pg_catalog.pg_class WHERE oid IN (SELECT oid FROM rels))),'[]'::pg_catalog.jsonb),
 'dependencies',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype)
   FROM pg_catalog.pg_depend d WHERE EXISTS (SELECT 1 FROM addresses a WHERE (a.classid=d.classid AND a.objid=d.objid) OR (a.classid=d.refclassid AND a.objid=d.refobjid))),'[]'::pg_catalog.jsonb),
 'shared_dependencies',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY d.dbid,d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.deptype) FROM sdeps d),'[]'::pg_catalog.jsonb),
 'comments',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('objoid',d.objoid,'classoid',d.classoid,'objsubid',d.objsubid,
   'sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.description,'UTF8')),'hex')) ORDER BY d.classoid,d.objoid,d.objsubid)
   FROM pg_catalog.pg_description d WHERE EXISTS (SELECT 1 FROM addresses a WHERE a.classid=d.classoid AND a.objid=d.objoid)),'[]'::pg_catalog.jsonb),
 'security_labels',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('objoid',s.objoid,'classoid',s.classoid,'objsubid',s.objsubid,'provider',s.provider,
   'sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.label,'UTF8')),'hex')) ORDER BY s.classoid,s.objoid,s.objsubid,s.provider)
   FROM pg_catalog.pg_seclabel s WHERE EXISTS (SELECT 1 FROM addresses a WHERE a.classid=s.classoid AND a.objid=s.objoid)),'[]'::pg_catalog.jsonb),
 'event_triggers',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) ORDER BY e.oid) FROM events e),'[]'::pg_catalog.jsonb),
 'roles',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'oid',r.oid::text,'name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,
   'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'can_login',r.rolcanlogin,
   'replication',r.rolreplication,'bypass_rls',r.rolbypassrls,
   'current_member',pg_catalog.pg_has_role(CURRENT_USER,r.oid,'MEMBER'),
   'current_usage',pg_catalog.pg_has_role(CURRENT_USER,r.oid,'USAGE'),
   'current_can_set',pg_catalog.pg_has_role(CURRENT_USER,r.oid,'SET')) ORDER BY r.oid)
   FROM pg_catalog.pg_roles r WHERE r.oid IN (SELECT oid FROM role_ids)),'[]'::pg_catalog.jsonb),
 'memberships',coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM memberships m),'[]'::pg_catalog.jsonb),
 'custom_or_unreviewed_behavior','NOT_ADMITTED_REQUIRES_INDEPENDENT_REVIEW')) AS crm_evidence;
