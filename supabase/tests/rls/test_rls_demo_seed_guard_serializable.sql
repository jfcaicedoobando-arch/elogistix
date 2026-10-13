-- Disposable CI only; no deployed database execution. Snapshot-isolation
-- rejection is checked before any business DML or core, without test bypasses.
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

CREATE FUNCTION pg_temp.demo_iso_forbid_dml() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'DEMO_TEST_UNEXPECTED_DML' USING ERRCODE='P0001';
END;
$$;
CREATE TRIGGER demo_test_iso_pricing BEFORE UPDATE ON public.crm_solicitudes_pricing
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_iso_forbid_dml();
CREATE TRIGGER demo_test_iso_fob BEFORE DELETE ON public.costeo_cargos_fob_agente
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_iso_forbid_dml();
CREATE TRIGGER demo_test_iso_rates BEFORE DELETE ON public.costeo_tarifas
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_iso_forbid_dml();
CREATE TRIGGER demo_test_iso_agents BEFORE DELETE ON public.costeo_agentes
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_iso_forbid_dml();
CREATE OR REPLACE FUNCTION public.seed_demo_organization_core()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'DEMO_TEST_UNEXPECTED_CORE' USING ERRCODE='P0001';
END;
$$;
INSERT INTO public.demo_seed_state(id,last_seeded_at) VALUES(true,'2000-01-01T00:00:00Z')
ON CONFLICT(id) DO UPDATE SET last_seeded_at=excluded.last_seeded_at;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);

DO $isolation$
DECLARE v_state text; v_message text; before_state jsonb;
BEGIN
  SELECT to_jsonb(x) INTO before_state FROM public.demo_seed_state x WHERE id=true;
  BEGIN
    PERFORM set_config('role','service_role',true);
    PERFORM public.seed_demo_organization_guarded(0);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
  END;
  RESET ROLE;
  IF (v_state='P0001' AND v_message='LC_SEED_DEMO_TENANT_UNSAFE: se requiere READ COMMITTED') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'DEMO TEST FAIL: SERIALIZABLE must deny before DML/core; got %/%',v_state,v_message;
  END IF;
  IF (SELECT to_jsonb(x) FROM public.demo_seed_state x WHERE id=true) IS DISTINCT FROM before_state THEN
    RAISE EXCEPTION 'DEMO TEST FAIL: isolation denial changed seed state';
  END IF;
END;
$isolation$;
ROLLBACK;
