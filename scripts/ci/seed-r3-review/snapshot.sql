SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(p),'xmin',p.xmin::text,'ctid',p.ctid::text) ORDER BY p.oid) FROM pg_catalog.pg_proc p WHERE p.pronamespace IN ('public'::regnamespace,'qa_owned'::regnamespace,'qa_fixture'::regnamespace)),
 'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(e),'xmin',e.xmin::text,'ctid',e.ctid::text) ORDER BY e.oid),'[]') FROM pg_catalog.pg_event_trigger e),
 'extensions',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.oid),'[]') FROM pg_catalog.pg_extension e),
 'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY classid,objid,objsubid,refclassid,refobjid,refobjsubid,deptype),'[]') FROM pg_catalog.pg_depend d),
 'triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY oid),'[]') FROM pg_catalog.pg_trigger t),
 'rewrite',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY oid),'[]') FROM pg_catalog.pg_rewrite r),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_catalog.pg_roles r),
 'control',(SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(c),'xmin',c.xmin::text,'ctid',c.ctid::text)) FROM qa_fixture.control c),
 'ledger',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]') FROM supabase_migrations.schema_migrations m),
 'marker',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.demo_seed_state m),
 'bridge_rows',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]') FROM qa_owned.bridge_target b)
);
