-- Global catalog ACL and policy guard. Safe in the parallel guard runner.
BEGIN;
\ir rls/_ci_check_global_catalog_acl.sql
-- Positive grants are checked after the repository's normal CI grant phase.
DO $positive_catalog_acl$
DECLARE t text; p text; expected boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['planes','navieras','puertos','tipos_contenedor','tipos_cambio_dof'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      expected := p='SELECT' OR (t <> 'tipos_cambio_dof' AND p IN ('INSERT','UPDATE','DELETE'));
      IF has_table_privilege('authenticated','public.' || t,p) IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'GLOBAL_CATALOG_AUTH_EXACT_MATRIX: %.%',t,p;
      END IF;
      IF NOT has_table_privilege('service_role','public.' || t,p) THEN
        RAISE EXCEPTION 'GLOBAL_CATALOG_SERVICE_EXACT_MATRIX: %.%',t,p;
      END IF;
    END LOOP;
  END LOOP;
END
$positive_catalog_acl$;
ROLLBACK;
