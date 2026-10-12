-- Execute in a SEPARATE query after confirmed or uncertain transaction outcome.
SELECT current_user::text, session_user::text, current_setting('server_version_num') AS server_version_num,
 p.oid, pg_get_userbyid(p.proowner) AS owner, p.proacl::text AS acl,
 p.proconfig, p.prosecdef,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS source_sha256,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') = '22243869551dd6eb27e055d2003c54526695e027c5181d1abc698ed5e36f0fca' AS expected_source,
 p.oid = 100911 AND pg_get_userbyid(p.proowner) = 'postgres'
 AND p.proacl::text = '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
 AND p.proconfig = ARRAY['search_path=public']::text[] AND p.prosecdef AS expected_access,
 (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261012160000') AS ledger_rows,
 (SELECT name FROM supabase_migrations.schema_migrations WHERE version='20261012160000') AS ledger_name,
 (SELECT encode(sha256(convert_to(array_to_string(statements,''),'UTF8')),'hex')
  FROM supabase_migrations.schema_migrations WHERE version='20261012160000') AS ledger_sql_sha256
FROM pg_catalog.pg_proc p WHERE p.oid='public.aceptar_cotizacion_version(uuid)'::regprocedure;
