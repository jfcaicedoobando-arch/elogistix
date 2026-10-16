-- LOCAL, UNREGISTERED, UNAPPLIED. No control row, run, identity, grant or runtime is installed.
BEGIN;
-- Preserve existing owners. Refuse installation under a different owner or without existing RLS authority.
DO $$ DECLARE v_owner oid; BEGIN
  SELECT proowner INTO STRICT v_owner FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure;
  IF v_owner <> current_user::regrole::oid
     OR v_owner <> (SELECT proowner FROM pg_proc WHERE oid='public.aprobar_factura_proveedor(uuid,boolean,text,timestamptz)'::regprocedure)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE oid=v_owner AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'DEMO_EXISTING_OWNER_REQUIRED: no owner/RLS/role changes are permitted';
  END IF;
  IF (SELECT encode(sha256(convert_to(btrim(prosrc,E' \n\r\t'),'UTF8')),'hex') FROM pg_proc WHERE oid='public._normalizar_razon_social()'::regprocedure) IS DISTINCT FROM '8f28941d9a8f51a9a4963dd5fc6426b58bd5a041049792b1aa3872000f80db8d' THEN
    RAISE EXCEPTION 'DEMO_NORMALIZATION_SOURCE_DRIFT'; END IF;
END $$;
CREATE SCHEMA demo_flow_writer;
REVOKE ALL ON SCHEMA demo_flow_writer FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE demo_flow_writer.control (
  singleton boolean PRIMARY KEY CHECK(singleton), enabled_value text NOT NULL DEFAULT 'false'
);
CREATE TABLE demo_flow_writer.lineages (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL CHECK(organization_id='00000000-0000-4000-8000-000000000001'),
  manifest_version text NOT NULL CHECK(manifest_version='seed-core-cxp-v1'),
  manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[0-9a-f]{64}$'),
  business_date date NOT NULL,
  source_session_principal name NOT NULL,
  initial_run_id uuid NOT NULL UNIQUE,
  initiator_kind text NOT NULL CHECK(initiator_kind IN ('human','scheduler')),
  initiator_user_id uuid, initiator_job_id text,
  CHECK((initiator_kind='human' AND initiator_user_id IS NOT NULL AND initiator_job_id IS NULL)
    OR (initiator_kind='scheduler' AND initiator_user_id IS NULL AND initiator_job_id IS NOT NULL AND initiator_job_id ~ '^[a-zA-Z0-9_-]{1,100}$'))
);
CREATE TABLE demo_flow_writer.runs (
  id uuid PRIMARY KEY, lineage_id uuid NOT NULL REFERENCES demo_flow_writer.lineages,
  purpose text NOT NULL CHECK(purpose IN ('initial','replay')),
  organization_id uuid NOT NULL CHECK(organization_id='00000000-0000-4000-8000-000000000001'),
  manifest_version text NOT NULL CHECK(manifest_version='seed-core-cxp-v1'), manifest_sha256 text NOT NULL,
  lineage_sha256 text NOT NULL CHECK(lineage_sha256 ~ '^[0-9a-f]{64}$'),
  expected_projection_sha256 text,
  session_principal name NOT NULL,
  initiator_kind text NOT NULL CHECK(initiator_kind IN ('human','scheduler')),
  initiator_user_id uuid, initiator_job_id text,
  not_before timestamptz NOT NULL, issued_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL, revoked_at timestamptz,
  UNIQUE(id,lineage_id),
  CHECK(issued_expires_at>not_before AND expires_at>not_before AND expires_at<=issued_expires_at),
  CHECK((purpose='initial' AND expected_projection_sha256 IS NULL)
    OR (purpose='replay' AND expected_projection_sha256 ~ '^[0-9a-f]{64}$' AND expected_projection_sha256 IS NOT NULL)),
  CHECK((initiator_kind='human' AND initiator_user_id IS NOT NULL AND initiator_job_id IS NULL)
    OR (initiator_kind='scheduler' AND initiator_user_id IS NULL AND initiator_job_id IS NOT NULL AND initiator_job_id ~ '^[a-zA-Z0-9_-]{1,100}$'))
);
ALTER TABLE demo_flow_writer.lineages ADD CONSTRAINT lineage_initial_run
  FOREIGN KEY(initial_run_id,id) REFERENCES demo_flow_writer.runs(id,lineage_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE demo_flow_writer.active_command (
  singleton boolean PRIMARY KEY CHECK(singleton), run_id uuid NOT NULL REFERENCES demo_flow_writer.runs
);
-- Produced by the other integrator, through its protected server path, never from HTTP or name matching.
-- A receipt attests exact existing IDs and row snapshots. This module does not create/adopt identities.
CREATE TABLE demo_flow_writer.identity_receipts (
  lineage_id uuid PRIMARY KEY REFERENCES demo_flow_writer.lineages,
  source_run_id uuid NOT NULL, source_version text NOT NULL CHECK(length(source_version)>0),
  source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
  bindings_sha256 text NOT NULL CHECK(bindings_sha256 ~ '^[0-9a-f]{64}$'),
  category_id uuid NOT NULL REFERENCES public.presupuesto_categorias,
  category_snapshot jsonb NOT NULL
);
CREATE TABLE demo_flow_writer.bindings (
  lineage_id uuid NOT NULL REFERENCES demo_flow_writer.identity_receipts,
  fixture_id text NOT NULL CHECK(fixture_id IN ('aap-vencida','ttn-vigente','ofc-parcial')),
  supplier_id uuid NOT NULL REFERENCES public.proveedores,
  shipment_id uuid NOT NULL REFERENCES public.embarques,
  supplier_snapshot jsonb NOT NULL, shipment_snapshot jsonb NOT NULL,
  invoice_id uuid NOT NULL UNIQUE, concept_ids uuid[] NOT NULL, payment_id uuid UNIQUE,
  fixture_sha256 text NOT NULL CHECK(fixture_sha256 ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY(lineage_id,fixture_id),
  UNIQUE(lineage_id,fixture_id,invoice_id),
  CHECK(array_position(concept_ids,NULL) IS NULL),
  CHECK(array_ndims(concept_ids)=1 AND array_lower(concept_ids,1)=1),
  CHECK((fixture_id='ttn-vigente' AND cardinality(concept_ids)=1 AND payment_id IS NULL)
     OR (fixture_id='aap-vencida' AND cardinality(concept_ids)=2 AND payment_id IS NULL)
     OR (fixture_id='ofc-parcial' AND cardinality(concept_ids)=2 AND payment_id IS NOT NULL))
);
CREATE TABLE demo_flow_writer.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lineage_id uuid NOT NULL, fixture_id text NOT NULL,
  execution_run_id uuid NOT NULL REFERENCES demo_flow_writer.runs,
  action text NOT NULL CHECK(action IN ('pending_header','concepts','final_version','approved','simulated_payment')),
  ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 5),
  actor_key text NOT NULL DEFAULT 'demo_generator' CHECK(actor_key='demo_generator'),
  input_sha256 text NOT NULL, snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL CHECK(snapshot_sha256=encode(sha256(convert_to(snapshot::text,'UTF8')),'hex')),
  previous_event_id uuid REFERENCES demo_flow_writer.events,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(lineage_id,fixture_id) REFERENCES demo_flow_writer.bindings,
  FOREIGN KEY(execution_run_id,lineage_id) REFERENCES demo_flow_writer.runs(id,lineage_id),
  UNIQUE(lineage_id,fixture_id,action,id), UNIQUE(lineage_id,fixture_id,ordinal),
  UNIQUE(lineage_id,fixture_id,action,id,execution_run_id,input_sha256,snapshot_sha256)
);
-- Three global slots: a different run cannot mint another copy of the same legacy fixture.
CREATE TABLE demo_flow_writer.fixture_claims (
  fixture_id text PRIMARY KEY, lineage_id uuid NOT NULL, invoice_id uuid NOT NULL UNIQUE,
  FOREIGN KEY(lineage_id,fixture_id,invoice_id) REFERENCES demo_flow_writer.bindings(lineage_id,fixture_id,invoice_id)
);
CREATE TABLE demo_flow_writer.receipts (
  lineage_id uuid NOT NULL, fixture_id text NOT NULL, action text NOT NULL,
  event_id uuid NOT NULL UNIQUE, execution_run_id uuid NOT NULL REFERENCES demo_flow_writer.runs, input_sha256 text NOT NULL, snapshot_sha256 text NOT NULL,
  PRIMARY KEY(lineage_id,fixture_id,action),
  FOREIGN KEY(execution_run_id,lineage_id) REFERENCES demo_flow_writer.runs(id,lineage_id),
  UNIQUE(lineage_id,fixture_id,action,event_id,execution_run_id,input_sha256,snapshot_sha256),
  FOREIGN KEY(lineage_id,fixture_id,action,event_id,execution_run_id,input_sha256,snapshot_sha256)
    REFERENCES demo_flow_writer.events(lineage_id,fixture_id,action,id,execution_run_id,input_sha256,snapshot_sha256)
    DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE demo_flow_writer.events ADD CONSTRAINT event_requires_receipt
  FOREIGN KEY(lineage_id,fixture_id,action,id,execution_run_id,input_sha256,snapshot_sha256)
    REFERENCES demo_flow_writer.receipts(lineage_id,fixture_id,action,event_id,execution_run_id,input_sha256,snapshot_sha256)
  DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE demo_flow_writer.current_approvals (
  invoice_id uuid PRIMARY KEY REFERENCES public.proveedor_facturas,
  lineage_id uuid NOT NULL, fixture_id text NOT NULL, action text NOT NULL DEFAULT 'approved' CHECK(action='approved'),
  event_id uuid NOT NULL UNIQUE,
  FOREIGN KEY(lineage_id,fixture_id,action,event_id) REFERENCES demo_flow_writer.events(lineage_id,fixture_id,action,id)
);
CREATE TABLE demo_flow_writer.simulated_payments (
  payment_id uuid PRIMARY KEY REFERENCES public.pagos_proveedor,
  lineage_id uuid NOT NULL, fixture_id text NOT NULL CHECK(fixture_id='ofc-parcial'),
  action text NOT NULL DEFAULT 'simulated_payment' CHECK(action='simulated_payment'), event_id uuid NOT NULL UNIQUE,
  FOREIGN KEY(lineage_id,fixture_id,action,event_id) REFERENCES demo_flow_writer.events(lineage_id,fixture_id,action,id)
);

CREATE FUNCTION demo_flow_writer.enabled() RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$
  SELECT COALESCE((SELECT enabled_value='true' FROM demo_flow_writer.control WHERE singleton),false);
$$;
CREATE FUNCTION demo_flow_writer.assert_active_organization() RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$ BEGIN
  PERFORM 1 FROM public.organizations WHERE id='00000000-0000-4000-8000-000000000001' AND activo IS TRUE FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_ORGANIZATION_INACTIVE' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION demo_flow_writer.entry_gate() RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $$ DECLARE v_flag text; BEGIN
  IF NOT demo_flow_writer.enabled() THEN RETURN false; END IF;
  SELECT enabled_value INTO v_flag FROM demo_flow_writer.control WHERE singleton FOR SHARE;
  IF v_flag IS DISTINCT FROM 'true' THEN RETURN false; END IF;
  IF current_user::regrole::oid<>(SELECT proowner FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure) THEN
    RAISE EXCEPTION 'DEMO_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM demo_flow_writer.assert_active_organization();
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));
  PERFORM demo_flow_writer.assert_active_organization();
  RETURN true;
END $$;
CREATE FUNCTION demo_flow_writer.authorize(p_run uuid) RETURNS demo_flow_writer.lineages
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v_lineage demo_flow_writer.lineages; v_request demo_flow_writer.runs; v_flag text; v_policy public.configuracion; v_close date;
BEGIN
  IF NOT demo_flow_writer.enabled() THEN RAISE EXCEPTION 'DEMO_DISABLED' USING ERRCODE='42501'; END IF;
  SELECT enabled_value INTO v_flag FROM demo_flow_writer.control WHERE singleton FOR SHARE;
  IF v_flag IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'DEMO_DISABLED' USING ERRCODE='42501'; END IF;
  IF current_user::regrole::oid<>(SELECT proowner FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure) THEN
    RAISE EXCEPTION 'DEMO_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM demo_flow_writer.assert_active_organization();
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));
  SELECT * INTO v_request FROM demo_flow_writer.runs WHERE id=p_run FOR UPDATE;
  IF NOT FOUND OR v_request.session_principal IS DISTINCT FROM session_user::name OR v_request.revoked_at IS NOT NULL
    OR clock_timestamp()<v_request.not_before OR clock_timestamp()>=v_request.expires_at THEN
    RAISE EXCEPTION 'DEMO_RUN_UNAUTHORIZED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_lineage FROM demo_flow_writer.lineages WHERE id=v_request.lineage_id FOR UPDATE;
  IF NOT FOUND OR (v_request.organization_id,v_request.manifest_version,v_request.manifest_sha256)
    IS DISTINCT FROM (v_lineage.organization_id,v_lineage.manifest_version,v_lineage.manifest_sha256)
    OR v_lineage.organization_id<>'00000000-0000-4000-8000-000000000001'::uuid
    OR v_lineage.manifest_version<>'seed-core-cxp-v1' OR v_lineage.manifest_sha256 IS DISTINCT FROM demo_flow_writer.manifest_sha256() THEN
    RAISE EXCEPTION 'DEMO_RUN_LINEAGE_CONFLICT' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM demo_flow_writer.bindings WHERE lineage_id=v_lineage.id ORDER BY fixture_id FOR UPDATE;
  IF (SELECT count(*) FROM demo_flow_writer.bindings WHERE lineage_id=v_lineage.id)<>3 THEN
    RAISE EXCEPTION 'DEMO_IDENTITY_INTEGRATION_REQUIRED' USING ERRCODE='55000'; END IF;
  PERFORM 1 FROM demo_flow_writer.identity_receipts WHERE lineage_id=v_lineage.id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_IDENTITY_INTEGRATION_REQUIRED' USING ERRCODE='55000'; END IF;
  IF v_request.lineage_sha256 IS DISTINCT FROM demo_flow_writer.lineage_sha256(v_lineage.id) THEN
    RAISE EXCEPTION 'DEMO_RUN_LINEAGE_SEAL_CONFLICT' USING ERRCODE='42501'; END IF;
  IF v_request.purpose='initial' THEN
    IF v_request.id IS DISTINCT FROM v_lineage.initial_run_id THEN
      RAISE EXCEPTION 'DEMO_INITIAL_RUN_CONFLICT' USING ERRCODE='42501'; END IF;
  ELSE
    IF v_request.id=v_lineage.initial_run_id OR (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=v_lineage.id)<>13
      OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage.id)<>13
      OR v_request.expected_projection_sha256 IS DISTINCT FROM demo_flow_writer.projection_sha256(v_lineage.id)
      OR (SELECT count(*) FROM demo_flow_writer.fixture_claims WHERE lineage_id=v_lineage.id)<>3 THEN
      RAISE EXCEPTION 'DEMO_REPLAY_AUTHORIZATION_CONFLICT' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT * INTO v_policy FROM public.configuracion WHERE organization_id=v_lineage.organization_id
    AND categoria='contabilidad' AND clave='cierre_periodo_fecha' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_PERIOD_ROW_REQUIRED' USING ERRCODE='55000'; END IF;
  IF v_policy.valor IS NULL OR (v_policy.valor<>'null'::jsonb AND (jsonb_typeof(v_policy.valor)<>'string'
      OR (v_policy.valor #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$')) THEN
    RAISE EXCEPTION 'DEMO_INVALID_PERIOD_POLICY' USING ERRCODE='22023'; END IF;
  v_close:=public.cierre_periodo_fecha(v_lineage.organization_id);
  IF v_close IS DISTINCT FROM (CASE WHEN v_policy.valor='null'::jsonb THEN NULL ELSE (v_policy.valor #>> '{}')::date END) THEN
    RAISE EXCEPTION 'DEMO_PERIOD_SNAPSHOT_CONFLICT' USING ERRCODE='40001'; END IF;
  IF v_lineage.business_date>public.fecha_negocio_mx() OR (v_close IS NOT NULL AND v_lineage.business_date-40<=v_close) THEN
    RAISE EXCEPTION 'DEMO_PERIOD_OR_DATE_CLOSED' USING ERRCODE='23514'; END IF;
  PERFORM demo_flow_writer.assert_active_organization();
  IF clock_timestamp()>=v_request.expires_at THEN RAISE EXCEPTION 'DEMO_RUN_EXPIRED' USING ERRCODE='42501'; END IF;
  RETURN v_lineage;
END $fn$;
CREATE FUNCTION demo_flow_writer.immutable() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'DEMO_IMMUTABLE_PROVENANCE' USING ERRCODE='42501'; END $$;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON demo_flow_writer.events
  FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE ON demo_flow_writer.receipts
  FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_bindings BEFORE UPDATE OR DELETE ON demo_flow_writer.bindings
  FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_identity BEFORE UPDATE OR DELETE ON demo_flow_writer.identity_receipts
  FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_claims BEFORE UPDATE OR DELETE ON demo_flow_writer.fixture_claims
  FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
-- Runs may only be revoked/shortened by their protected server controller. Other input changes are rejected.
CREATE FUNCTION demo_flow_writer.protect_run() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $$ BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['revoked_at','expires_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revoked_at','expires_at'])
    OR NEW.expires_at>OLD.expires_at OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
    RAISE EXCEPTION 'DEMO_IMMUTABLE_RUN' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_lineages BEFORE UPDATE OR DELETE ON demo_flow_writer.lineages
  FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER protect_run BEFORE UPDATE OR DELETE ON demo_flow_writer.runs
  FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.protect_run();

-- New private objects only. Existing table RLS, policies, owners and application ACL remain untouched.
REVOKE ALL ON ALL TABLES IN SCHEMA demo_flow_writer FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
