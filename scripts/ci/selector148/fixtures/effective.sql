SELECT jsonb_pretty(jsonb_agg(to_jsonb(q) ORDER BY signature)) FROM (
 SELECT p.oid::regprocedure::text signature, pg_get_userbyid(p.proowner) owner, p.proacl raw_acl,
 (SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege_type',a.privilege_type,'is_grantable',a.is_grantable) ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a) expanded_acl,
 (SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'execute',has_function_privilege(r.oid,p.oid,'EXECUTE'),'execute_with_grant_option',has_function_privilege(r.oid,p.oid,'EXECUTE WITH GRANT OPTION')) ORDER BY r.rolname) FROM pg_roles r) effective_roles
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
)q;
