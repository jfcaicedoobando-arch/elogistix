-- ADMINISTRATOR FIXTURE ONLY. Not part of proposed migration.
CREATE SCHEMA qa_fixture AUTHORIZATION supabase_admin;
CREATE TABLE qa_fixture.control(first_oid oid,last_oid oid,tracked oid[],renames integer NOT NULL DEFAULT 0,armed boolean NOT NULL DEFAULT false,mutation text NOT NULL DEFAULT 'cost',fired boolean NOT NULL DEFAULT false);
INSERT INTO qa_fixture.control(first_oid,last_oid,tracked)
 SELECT min(oid::bigint)::oid,max(oid::bigint)::oid,array_agg(oid ORDER BY oid) FROM pg_catalog.pg_proc WHERE oid IN
 ('public._seed_demo_limpiar_financiero()'::regprocedure,'public.seed_demo_organization_core()'::regprocedure,'public.seed_demo_organization()'::regprocedure,'public.seed_demo_organization_guarded(bigint)'::regprocedure);
GRANT USAGE ON SCHEMA qa_fixture TO postgres;
GRANT SELECT ON qa_fixture.control TO postgres;
CREATE FUNCTION qa_fixture.mutate_first_on_last_restore() RETURNS event_trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,qa_fixture AS $trigger$
DECLARE c record; d record; n text; src text; definition text;
BEGIN
 SELECT * INTO STRICT c FROM qa_fixture.control;
 IF NOT c.armed OR c.fired THEN RETURN; END IF;
 FOR d IN SELECT * FROM pg_catalog.pg_event_trigger_ddl_commands() LOOP
  IF d.classid='pg_catalog.pg_proc'::regclass AND d.objid=ANY(c.tracked) THEN
   UPDATE qa_fixture.control SET renames=renames+1 RETURNING * INTO c;
   SELECT proname INTO n FROM pg_catalog.pg_proc WHERE oid=d.objid;
   IF c.renames=8 AND d.objid=c.last_oid AND n NOT LIKE '_lc_demo_lock_%' THEN
    -- Mark before recursive DDL; this table change rolls back with rejected admission.
    UPDATE qa_fixture.control SET fired=true;
    IF c.mutation='cost' THEN
     EXECUTE pg_catalog.format('ALTER FUNCTION %s COST 101',c.first_oid::regprocedure);
    ELSIF c.mutation='prosrc' THEN
     SELECT prosrc,pg_catalog.pg_get_functiondef(oid) INTO src,definition FROM pg_catalog.pg_proc WHERE oid=c.first_oid;
     EXECUTE pg_catalog.replace(definition,src,src||E'\n-- QA_EVENT_DRIFT_MARKER\n');
    ELSE RAISE EXCEPTION 'Unknown fixture mutation'; END IF;
   END IF;
  END IF;
 END LOOP;
END $trigger$;
REVOKE ALL ON FUNCTION qa_fixture.mutate_first_on_last_restore() FROM PUBLIC;
CREATE EVENT TRIGGER qa_r3_drift ON ddl_command_end WHEN TAG IN ('ALTER FUNCTION') EXECUTE FUNCTION qa_fixture.mutate_first_on_last_restore();
