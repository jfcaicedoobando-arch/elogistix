\set ON_ERROR_STOP on
-- Compile-only checks after canonical validation and all unchanged upstream DDL.
-- The runner loads these public metadata TEMP tables in this same session:
-- financial_compile_expected_functions(schema_name,name,language,body_sha256)
-- financial_compile_expected_objects(kind,schema_name,name,parent_name)
BEGIN;
SET LOCAL check_function_bodies = on;
DO $verify$
DECLARE
 obj record;
 relation_kind text;
 has_rows boolean;
 wrapper text;
 v_role_name text;
 v_schema_name text;
 wanted_count bigint;
 actual_count bigint;
 core_oid oid := to_regprocedure('public.seed_demo_organization_core()');
BEGIN
 IF current_database() <> 'demo_financial_compile_recovery_lab'
 OR current_setting('server_version_num') <> '170006'
 OR current_user <> 'postgres' OR session_user <> 'postgres'
 OR current_setting('listen_addresses') <> '' OR inet_server_addr() IS NOT NULL
 OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT rolsuper AND rolbypassrls AND NOT rolinherit
   AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_has_role(current_user,'supabase_admin','MEMBER') THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_SYNTHETIC_CANDIDATE_REQUIRED';
 END IF;
 IF to_regclass('pg_temp.financial_compile_expected_functions') IS NULL
 OR to_regclass('pg_temp.financial_compile_expected_objects') IS NULL THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_EXPECTED_MANIFEST_REQUIRED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_temp.financial_compile_expected_functions)
 OR NOT EXISTS (SELECT 1 FROM pg_temp.financial_compile_expected_objects WHERE kind='table')
 OR EXISTS (SELECT 1 FROM pg_temp.financial_compile_expected_functions
   WHERE schema_name IS DISTINCT FROM 'public' OR name IS NULL OR name=''
     OR language IS NULL OR language NOT IN ('sql','plpgsql')
     OR body_sha256 IS NULL OR body_sha256 !~ '^[0-9a-f]{64}$'
     OR name IN ('seed_demo_organization_core','seed_demo_organization','seed_demo_organization_guarded','_seed_demo_limpiar_financiero'))
 OR EXISTS (SELECT 1 FROM pg_temp.financial_compile_expected_objects
   WHERE schema_name IS DISTINCT FROM 'public' OR name IS NULL OR name=''
     OR kind IS NULL OR kind NOT IN ('collation','type','table','sequence','function','constraint','index','view','trigger')) THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_INVALID_EXPECTED_MANIFEST';
 END IF;

 -- The only extra public function is the upstream fail-closed ownership fixture.
 IF core_oid IS NULL OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=core_oid
   AND proowner=current_user::regrole::oid AND prosecdef AND prorettype='void'::regtype
   AND btrim(prosrc,E' \n\r\t')=$body$BEGIN RAISE EXCEPTION 'SYNTHETIC_OWNER_METADATA_ONLY_NO_SEED'; END$body$) THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_FAIL_CLOSED_CORE_METADATA_REQUIRED';
 END IF;
 IF EXISTS (
  WITH expected AS (
   SELECT f.schema_name,f.name,f.language,f.body_sha256,count(*) AS copies
   FROM pg_temp.financial_compile_expected_functions f GROUP BY 1,2,3,4
  ), actual AS (
   SELECT n.nspname::text AS schema_name,p.proname::text AS name,l.lanname::text AS language,
     encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS body_sha256,count(*) AS copies
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
   WHERE n.nspname='public' AND p.oid<>core_oid GROUP BY 1,2,3,4
  )
  SELECT 1 FROM ((SELECT * FROM expected EXCEPT SELECT * FROM actual)
   UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)) difference
 ) THEN RAISE EXCEPTION 'FINANCIAL_COMPILE_CANONICAL_FUNCTION_MULTISET_MISMATCH'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('public','demo_flow_writer','demo_fixture_identity')
     AND p.proowner<>current_user::regrole::oid) THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_FUNCTION_OWNER_MISMATCH';
 END IF;

 FOR obj IN SELECT * FROM pg_temp.financial_compile_expected_objects LOOP
  IF obj.kind='function' THEN CONTINUE;
  ELSIF obj.kind IN ('table','sequence','index','view') THEN
   SELECT c.relkind::text INTO relation_kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=obj.schema_name AND c.relname=obj.name;
   IF NOT FOUND OR (obj.kind='table' AND relation_kind NOT IN ('r','p'))
    OR (obj.kind='sequence' AND relation_kind<>'S')
    OR (obj.kind='index' AND relation_kind NOT IN ('i','I'))
    OR (obj.kind='view' AND relation_kind<>'v') THEN
    RAISE EXCEPTION 'FINANCIAL_COMPILE_CANONICAL_RELATION_MISSING: %',obj.kind;
   END IF;
  ELSIF obj.kind='type' THEN
   IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
     WHERE n.nspname=obj.schema_name AND t.typname=obj.name) THEN
    RAISE EXCEPTION 'FINANCIAL_COMPILE_CANONICAL_TYPE_MISSING'; END IF;
  ELSIF obj.kind='collation' THEN
   IF NOT EXISTS (SELECT 1 FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace
     WHERE n.nspname=obj.schema_name AND c.collname=obj.name) THEN
    RAISE EXCEPTION 'FINANCIAL_COMPILE_CANONICAL_COLLATION_MISSING'; END IF;
  ELSIF obj.kind='constraint' THEN
   IF obj.parent_name IS NULL OR NOT EXISTS (SELECT 1 FROM pg_constraint c
     WHERE c.conrelid=to_regclass(format('%I.%I',obj.schema_name,obj.parent_name)) AND c.conname=obj.name) THEN
    RAISE EXCEPTION 'FINANCIAL_COMPILE_CANONICAL_CONSTRAINT_MISSING'; END IF;
  ELSIF obj.kind='trigger' THEN
   IF obj.parent_name IS NULL OR NOT EXISTS (SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid=to_regclass(format('%I.%I',obj.schema_name,obj.parent_name))
       AND t.tgname=obj.name AND NOT t.tgisinternal) THEN
    RAISE EXCEPTION 'FINANCIAL_COMPILE_CANONICAL_TRIGGER_MISSING'; END IF;
  END IF;
 END LOOP;
 -- Global counts are meaningful for fresh public tables/views/enums/collations.
 -- Index/constraint/sequence counts also include implicit objects, so the checks
 -- above certify selected objects without mislabelling implicit objects as spans.
 SELECT count(DISTINCT name) INTO wanted_count FROM pg_temp.financial_compile_expected_objects WHERE kind='table';
 SELECT count(*) INTO actual_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p');
 IF actual_count<>wanted_count THEN RAISE EXCEPTION 'FINANCIAL_COMPILE_PUBLIC_TABLE_COUNT_MISMATCH'; END IF;
 SELECT count(DISTINCT name) INTO wanted_count FROM pg_temp.financial_compile_expected_objects WHERE kind='view';
 SELECT count(*) INTO actual_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='v';
 IF actual_count<>wanted_count THEN RAISE EXCEPTION 'FINANCIAL_COMPILE_PUBLIC_VIEW_COUNT_MISMATCH'; END IF;
 SELECT count(DISTINCT name) INTO wanted_count FROM pg_temp.financial_compile_expected_objects WHERE kind='type';
 SELECT count(*) INTO actual_count FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
  WHERE n.nspname='public' AND t.typtype='e';
 IF actual_count<>wanted_count THEN RAISE EXCEPTION 'FINANCIAL_COMPILE_PUBLIC_ENUM_COUNT_MISMATCH'; END IF;
 SELECT count(DISTINCT name) INTO wanted_count FROM pg_temp.financial_compile_expected_objects WHERE kind='collation';
 SELECT count(*) INTO actual_count FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace
  WHERE n.nspname='public';
 IF actual_count<>wanted_count THEN RAISE EXCEPTION 'FINANCIAL_COMPILE_PUBLIC_COLLATION_COUNT_MISMATCH'; END IF;

 FOREACH wrapper IN ARRAY ARRAY[
  'demo_flow_writer.prepare_authorized_run(uuid)',
  'demo_flow_writer.assert_issued(uuid)',
  'demo_flow_writer.execute_and_checkpoint(uuid,bigint)',
  'demo_flow_writer.human_approval_main(uuid,boolean,text,timestamptz)',
  'demo_flow_writer.demo_approval_main(uuid,boolean,text,timestamptz,uuid,text)',
  'demo_flow_writer.common_approval(uuid,boolean,text,timestamptz,uuid,text)',
  'demo_flow_writer.assert_rpc_transport()',
  'demo_flow_writer.prepare_execute_checkpoint(uuid,bigint)',
  'demo_flow_writer.reconcile_context(uuid)',
  'demo_flow_writer.assert_context_read_access(uuid)',
  'demo_flow_writer.assert_registry_owner()',
  'demo_flow_writer.validated_scheduler(uuid)',
  'demo_flow_writer.issue_scheduler_context(uuid,uuid,integer)',
  'demo_flow_writer.read_server_context(uuid)',
  'demo_flow_writer.reconcile_run(uuid)',
  'demo_flow_writer.verify_identity_receipt(uuid)',
  'demo_fixture_identity.verify_preparation_origin(uuid)',
  'demo_fixture_identity.prepare_identity_receipt(uuid)',
  'demo_fixture_identity.assert_preparation_admission(uuid)'
 ] LOOP
  IF to_regprocedure(wrapper) IS NULL THEN RAISE EXCEPTION 'FINANCIAL_COMPILE_UPSTREAM_WRAPPER_MISSING'; END IF;
 END LOOP;
 IF (SELECT encode(sha256(convert_to(btrim(prosrc,E' \n\r\t'),'UTF8')),'hex') FROM pg_proc
   WHERE oid='public._normalizar_razon_social()'::regprocedure)
     IS DISTINCT FROM '8f28941d9a8f51a9a4963dd5fc6426b58bd5a041049792b1aa3872000f80db8d'
 OR (SELECT encode(sha256(convert_to(btrim(prosrc,E' \n\r\t'),'UTF8')),'hex') FROM pg_proc
   WHERE oid='public.aprobar_factura_proveedor(uuid,boolean,text,timestamptz)'::regprocedure)
     IS DISTINCT FROM 'd1327ae0f1cdf0135ce5d11599921c261d17b948c524b426f6deb97553d279c0'
 OR (SELECT encode(sha256(convert_to(btrim(prosrc,E' \n\r\t'),'UTF8')),'hex') FROM pg_proc
   WHERE oid='demo_flow_writer.human_approval_main(uuid,boolean,text,timestamptz)'::regprocedure)
     IS DISTINCT FROM 'd1327ae0f1cdf0135ce5d11599921c261d17b948c524b426f6deb97553d279c0' THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_CANONICAL_GUARD_BODY_DRIFT';
 END IF;
 IF (SELECT prosrc FROM pg_proc WHERE oid='demo_flow_writer.assert_rpc_transport()'::regprocedure)
    NOT LIKE '%DEMO_REGISTERED_RPC_TRANSPORT_REQUIRED%'
 OR (SELECT prosrc FROM pg_proc WHERE oid='demo_flow_writer.assert_context_read_access(uuid)'::regprocedure)
    NOT LIKE '%DEMO_CONTEXT_HISTORY_ACCESS_DENIED%' THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_FINAL_REGISTRY_REPLACEMENT_REQUIRED';
 END IF;

 FOREACH v_schema_name IN ARRAY ARRAY['demo_flow_writer','demo_fixture_identity'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=v_schema_name AND nspowner=current_user::regrole::oid) THEN
   RAISE EXCEPTION 'FINANCIAL_COMPILE_PRIVATE_SCHEMA_OWNER_MISMATCH'; END IF;
  FOREACH v_role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_schema_privilege(v_role_name,v_schema_name,'USAGE') OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=v_schema_name AND has_function_privilege(v_role_name,p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'FINANCIAL_COMPILE_PRIVATE_BOUNDARY_NOT_CLOSED'; END IF;
  END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='demo_flow_writer' AND c.relkind IN ('r','p'))<>17
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='demo_fixture_identity' AND c.relkind IN ('r','p'))<>5 THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_PRIVATE_REGISTRY_TABLE_COUNT_MISMATCH';
 END IF;
 FOR obj IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','demo_flow_writer','demo_fixture_identity','auth','financial_compile_fixture')
     AND c.relkind IN ('r','p') LOOP
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)',obj.nspname,obj.relname) INTO has_rows;
  IF has_rows THEN RAISE EXCEPTION 'FINANCIAL_COMPILE_DATA_MUST_REMAIN_EMPTY'; END IF;
 END LOOP;
 IF auth.uid() IS NOT NULL OR auth.role() IS NOT NULL OR auth.jwt() IS DISTINCT FROM '{}'::jsonb
 OR demo_flow_writer.enabled() IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_AUTH_AND_DEMO_MUST_REMAIN_UNBOUND';
 END IF;
END $verify$;

SELECT jsonb_build_object(
 'status','PASS_COMPILE_ONLY','scope','SYNTHETIC_DDL_COMPILE_ONLY',
 'server_version_num',current_setting('server_version_num'),
 'canonical_function_rows',(SELECT count(*) FROM pg_temp.financial_compile_expected_functions),
 'selected_object_rows',(SELECT count(*) FROM pg_temp.financial_compile_expected_objects),
 'canonical_function_source_multiset_verified',true,'selected_objects_verified',true,
 'all_candidate_tables_empty',true,'synthetic_auth_helpers_empty',true,
 'real_identity','NOT_RUN','financial_business','NOT_RUN','deferred_runtime','NOT_RUN',
 'operational_transport','UNBOUND','demo','DISABLED');
COMMIT;
SELECT 'FINANCIAL_COMPILE_INSTALL_VERIFIED';
