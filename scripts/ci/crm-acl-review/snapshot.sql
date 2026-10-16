SELECT jsonb_object_agg(name,rows) FROM (
SELECT 'pg_proc' name,coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.oid),'[]') rows FROM pg_proc x WHERE pronamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth'))
UNION ALL SELECT 'pg_trigger',coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.oid),'[]') FROM pg_trigger x WHERE tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth')))
UNION ALL SELECT 'pg_class',coalesce(jsonb_agg(to_jsonb(x)-ARRAY['relpages','reltuples','relallvisible','relfrozenxid','relminmxid'] ORDER BY x.oid),'[]') FROM pg_class x WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth'))
UNION ALL SELECT 'pg_attribute',coalesce(jsonb_agg(to_jsonb(x) ORDER BY attrelid,attnum),'[]') FROM pg_attribute x WHERE attrelid IN(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth')))
UNION ALL SELECT 'pg_depend',coalesce(jsonb_agg(to_jsonb(x) ORDER BY classid,objid,objsubid,refclassid,refobjid,refobjsubid,deptype),'[]') FROM pg_depend x
UNION ALL SELECT 'pg_description',coalesce(jsonb_agg(to_jsonb(x) ORDER BY classoid,objoid,objsubid),'[]') FROM pg_description x
UNION ALL SELECT 'pg_seclabel',coalesce(jsonb_agg(to_jsonb(x) ORDER BY classoid,objoid,objsubid,provider),'[]') FROM pg_seclabel x
UNION ALL SELECT 'pg_shdepend',coalesce(jsonb_agg(to_jsonb(x) ORDER BY dbid,classid,objid,objsubid,refclassid,refobjid,deptype),'[]') FROM pg_shdepend x WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database())
UNION ALL SELECT 'pg_constraint',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_constraint x WHERE connamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth'))
UNION ALL SELECT 'pg_inherits',coalesce(jsonb_agg(to_jsonb(x) ORDER BY inhrelid,inhseqno),'[]') FROM pg_inherits x
UNION ALL SELECT 'pg_namespace',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_namespace x WHERE nspname IN ('public','auth')
UNION ALL SELECT 'pg_type',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_type x WHERE typnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth'))
UNION ALL SELECT 'pg_attrdef',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_attrdef x WHERE adrelid IN(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth')))
UNION ALL SELECT 'pg_index',coalesce(jsonb_agg(to_jsonb(x) ORDER BY indexrelid),'[]') FROM pg_index x WHERE indrelid IN(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth')))
UNION ALL SELECT 'pg_policy',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_policy x WHERE polrelid IN(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth')))
UNION ALL SELECT 'pg_rewrite',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_rewrite x WHERE ev_class IN(SELECT oid FROM pg_class WHERE relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('public','auth')))
UNION ALL SELECT 'pg_default_acl',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_default_acl x WHERE true
UNION ALL SELECT 'pg_event_trigger',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_event_trigger x WHERE true
UNION ALL SELECT 'pg_extension',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_extension x WHERE true
UNION ALL SELECT 'pg_enum',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_enum x WHERE true
) q;
