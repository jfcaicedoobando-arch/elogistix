SELECT jsonb_pretty(jsonb_build_object(
'relations',(SELECT jsonb_agg(to_jsonb(q) ORDER BY name) FROM(SELECT c.oid::regclass::text name,c.relkind,pg_get_userbyid(c.relowner) owner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')q),
'policies',(SELECT jsonb_agg(to_jsonb(q) ORDER BY schemaname,tablename,policyname) FROM(SELECT * FROM pg_policies WHERE schemaname='public')q),
'default_acl',(SELECT jsonb_agg(to_jsonb(q) ORDER BY owner,schema,object_type) FROM(SELECT pg_get_userbyid(defaclrole) owner,defaclnamespace::regnamespace::text schema,defaclobjtype object_type,defaclacl FROM pg_default_acl)q)
));
