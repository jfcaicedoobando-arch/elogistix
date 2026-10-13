WITH target_tables AS (
  SELECT n.nspname, c.oid, c.relname, c.relowner, c.relrowsecurity, c.relforcerowsecurity,
    c.relkind, c.relacl, c.reloptions
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE (n.nspname='public' AND c.relname IN
    ('planes','navieras','puertos','tipos_contenedor','tipos_cambio_dof','user_roles','organizations'))
    OR (n.nspname='supabase_migrations' AND c.relname='schema_migrations')
), table_metadata AS (
  SELECT t.relname AS name, jsonb_build_object(
    'schema',t.nspname,'name',t.relname,'kind',t.relkind,'owner',pg_catalog.pg_get_userbyid(t.relowner),
    'rls',t.relrowsecurity,'force_rls',t.relforcerowsecurity,'options',t.reloptions,
    'acl',COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,
       'grantor',pg_catalog.pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
       ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,a.privilege_type,pg_catalog.pg_get_userbyid(a.grantor))
       FROM pg_catalog.aclexplode(COALESCE(t.relacl,pg_catalog.acldefault('r',t.relowner))) a),'[]'::jsonb),
    'columns',COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'number',a.attnum,'name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
       'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
       'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
       'acl',COALESCE((SELECT jsonb_agg(jsonb_build_object(
         'grantee',CASE WHEN ca.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(ca.grantee) END,
         'grantor',pg_catalog.pg_get_userbyid(ca.grantor),'privilege',ca.privilege_type,'grantable',ca.is_grantable)
         ORDER BY CASE WHEN ca.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(ca.grantee) END,ca.privilege_type)
         FROM pg_catalog.aclexplode(a.attacl) ca),'[]'::jsonb)) ORDER BY a.attnum)
       FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
       WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),
    'constraints',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,
       'validated',c.convalidated,'deferrable',c.condeferrable,'initially_deferred',c.condeferred,
       'definition',pg_catalog.pg_get_constraintdef(c.oid,true)) ORDER BY c.conname)
       FROM pg_catalog.pg_constraint c WHERE c.conrelid=t.oid),'[]'::jsonb),
    'policies',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,
       'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(r) END ORDER BY CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(r) END) FROM unnest(p.polroles) r),
       'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),
       'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname)
       FROM pg_catalog.pg_policy p WHERE p.polrelid=t.oid),'[]'::jsonb),
    'triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',g.tgname,'enabled',g.tgenabled,
       'internal',g.tgisinternal,'definition',pg_catalog.pg_get_triggerdef(g.oid,true),
       'function_owner',pg_catalog.pg_get_userbyid(f.proowner),'function_acl',f.proacl::text,
       'function_definition',pg_catalog.pg_get_functiondef(f.oid)) ORDER BY g.tgname)
       FROM pg_catalog.pg_trigger g JOIN pg_catalog.pg_proc f ON f.oid=g.tgfoid WHERE g.tgrelid=t.oid AND NOT g.tgisinternal),'[]'::jsonb),
    'rules',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',r.rulename,'definition',pg_catalog.pg_get_ruledef(r.oid,true)) ORDER BY r.rulename)
       FROM pg_catalog.pg_rewrite r WHERE r.ev_class=t.oid),'[]'::jsonb)
  ) AS detail FROM target_tables t
), relevant_memberships AS (
  SELECT m.* FROM pg_catalog.pg_auth_members m
  WHERE m.member IN (SELECT oid FROM pg_catalog.pg_roles WHERE rolname IN
    ('anon','authenticated','service_role','sandbox_exec','postgres'))
), dependent_views AS (
  SELECT DISTINCT v.oid,v.relname,v.relowner,v.relacl,v.reloptions,n.nspname
  FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_rewrite r ON r.oid=d.objid
  JOIN pg_catalog.pg_class v ON v.oid=r.ev_class JOIN pg_catalog.pg_namespace n ON n.oid=v.relnamespace
  WHERE d.classid='pg_catalog.pg_rewrite'::regclass
    AND d.refclassid='pg_catalog.pg_class'::regclass
    AND d.refobjid IN (SELECT oid FROM target_tables WHERE relname IN
      ('planes','navieras','puertos','tipos_contenedor','tipos_cambio_dof'))
    AND v.relkind IN ('v','m')
)
SELECT jsonb_build_object(
  'context',jsonb_build_object('current_user',current_user,'search_path',current_setting('search_path'),
    'schemas',current_schemas(true),'server_version_num',current_setting('server_version_num')),
  'tables',COALESCE((SELECT jsonb_agg(detail ORDER BY name) FROM table_metadata),'[]'::jsonb),
  'functions',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',p.proname,'args',pg_catalog.pg_get_function_identity_arguments(p.oid),
    'owner',pg_catalog.pg_get_userbyid(p.proowner),'acl',p.proacl::text,
    'definition',pg_catalog.pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid))
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE (n.nspname='public' AND p.proname IN
      ('has_role','roles_jerarquia','tc_dof_upsert_manual','current_user_org_id','default_user_org_id','get_user_context'))
      OR (n.nspname='auth' AND p.proname='uid')),'[]'::jsonb),
  'roles',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,
    'inherit',r.rolinherit,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,
    'can_login',r.rolcanlogin,'replication',r.rolreplication,'bypass_rls',r.rolbypassrls,
    'config',r.rolconfig) ORDER BY r.rolname) FROM pg_catalog.pg_roles r WHERE r.rolname IN
      ('anon','authenticated','service_role','sandbox_exec','postgres')),'[]'::jsonb),
  'memberships',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'member',pg_catalog.pg_get_userbyid(m.member),'role',pg_catalog.pg_get_userbyid(m.roleid),
    'grantor',pg_catalog.pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
    ORDER BY pg_catalog.pg_get_userbyid(m.member),pg_catalog.pg_get_userbyid(m.roleid)) FROM relevant_memberships m),'[]'::jsonb),
  'app_roles',COALESCE((SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_catalog.pg_enum e
    WHERE e.enumtypid='public.app_role'::regtype),'[]'::jsonb),
  'incoming_foreign_keys',COALESCE((SELECT jsonb_agg(jsonb_build_object('source',n.nspname||'.'||s.relname,
    'name',c.conname,'definition',pg_catalog.pg_get_constraintdef(c.oid,true),'validated',c.convalidated)
    ORDER BY n.nspname,s.relname,c.conname) FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class s ON s.oid=c.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=s.relnamespace
    WHERE c.contype='f' AND c.confrelid IN (SELECT oid FROM target_tables WHERE relname IN
      ('planes','navieras','puertos','tipos_contenedor','tipos_cambio_dof'))),'[]'::jsonb),
  'dependent_views',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',v.nspname||'.'||v.relname,
    'owner',pg_catalog.pg_get_userbyid(v.relowner),'acl',v.relacl::text,'options',v.reloptions,
    'definition',pg_catalog.pg_get_viewdef(v.oid,true)) ORDER BY v.nspname,v.relname) FROM dependent_views v),'[]'::jsonb),
  'event_triggers',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,
    'owner',pg_catalog.pg_get_userbyid(e.evtowner),'enabled',e.evtenabled,'tags',e.evttags,
    'function',pg_catalog.pg_get_functiondef(e.evtfoid),
    'function_owner',pg_catalog.pg_get_userbyid(f.proowner),'function_acl',f.proacl::text)
    ORDER BY e.evtname) FROM pg_catalog.pg_event_trigger e JOIN pg_catalog.pg_proc f ON f.oid=e.evtfoid),'[]'::jsonb),
  'ledger',jsonb_build_object('apply_version','20261013040000','rollback_version','20261013040001',
    'rows',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.version) FROM supabase_migrations.schema_migrations l
    WHERE l.version IN ('20261013040000','20261013040001')),'[]'::jsonb))
) AS snapshot;
