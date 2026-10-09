SELECT jsonb_pretty(jsonb_agg(to_jsonb(q) ORDER BY signature)) FROM (
 SELECT p.oid::regprocedure::text signature, pg_get_userbyid(p.proowner) owner,
 l.lanname language, pg_get_function_result(p.oid) result,
 pg_get_function_identity_arguments(p.oid) identity_arguments,
 pg_get_expr(p.proargdefaults,0) defaults,p.provolatile volatility,
 p.prosecdef security_definer,p.proparallel parallel,p.proisstrict strict,
 p.proleakproof leakproof,p.proretset returns_set,p.proconfig config,
 p.proacl acl,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') service_role_execute,p.prosrc source
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='public'
) q;
