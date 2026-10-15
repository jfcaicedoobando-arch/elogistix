-- Creates dependencies without evaluating a seed or the view.
CREATE SCHEMA qa_owned AUTHORIZATION postgres;
CREATE VIEW qa_owned.guard_view AS SELECT public.seed_demo_organization_guarded(600000) AS stopped;
CREATE TABLE qa_owned.bridge_target(id integer PRIMARY KEY);
CREATE FUNCTION qa_owned.guard_bridge() RETURNS trigger LANGUAGE plpgsql AS $bridge$
BEGIN
 PERFORM public.seed_demo_organization_guarded(600000);
 RETURN NEW;
END $bridge$;
CREATE TRIGGER guard_bridge BEFORE INSERT ON qa_owned.bridge_target
 FOR EACH ROW EXECUTE FUNCTION qa_owned.guard_bridge();
-- pg_depend records view rewrite -> guarded OID, and pg_trigger -> bridge OID.
-- PL/pgSQL textual bridge -> guarded call is NOT claimed to be in pg_depend.
