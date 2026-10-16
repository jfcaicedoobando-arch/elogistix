DO $$ DECLARE app record; obj text; BEGIN
 IF EXISTS(SELECT 1 FROM demo_flow_writer.authority_fences)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.protected_occurrences)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.occurrence_context_bindings)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.occurrence_revocations) THEN
  RAISE EXCEPTION 'Authority proposal configured real rows'; END IF;
 FOR app IN SELECT oid FROM pg_roles WHERE rolname IN('anon','authenticated','service_role','authority_outsider') LOOP
  FOREACH obj IN ARRAY ARRAY['authority_fences','protected_occurrences','occurrence_context_bindings','occurrence_revocations'] LOOP
   IF has_table_privilege(app.oid,'demo_flow_writer.'||obj,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN RAISE EXCEPTION 'Authority ACL leaked table %',obj; END IF;
  END LOOP;
  IF has_function_privilege(app.oid,'demo_flow_writer.read_authority(uuid)','EXECUTE') OR has_function_privilege(app.oid,'demo_flow_writer.issue_bound_context(uuid)','EXECUTE') OR has_function_privilege(app.oid,'demo_flow_writer.checked_occurrence(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Authority ACL leaked function'; END IF;
 END LOOP;
END $$;
SELECT 'AUTHORITY_EMPTY_OWNER_ONLY_COMPLETE';
