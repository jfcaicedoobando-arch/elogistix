-- REVIEW-ONLY DDL. All registries start EMPTY. No configuration INSERT, GRANT, role
-- creation, credential, API exposure or activation is included or authorized.
-- Concrete authority mode: explicitly approved SCHEDULER delegation. Never present
-- the approving sponsor as a human who authenticated the current RPC.
BEGIN;
CREATE TABLE demo_flow_writer.transport_approvals (
 id uuid PRIMARY KEY, owner_oid oid NOT NULL, login_role_oid oid NOT NULL,
 technical_role_oid oid NOT NULL, organization_id uuid NOT NULL
   CHECK(organization_id='00000000-0000-4000-8000-000000000001'),
 approved_by_owner oid NOT NULL, valid_until timestamptz NOT NULL,
 disabled_at timestamptz, CHECK(approved_by_owner=owner_oid)
);
CREATE TABLE demo_flow_writer.scheduler_approvals (
 id uuid PRIMARY KEY, transport_id uuid NOT NULL REFERENCES demo_flow_writer.transport_approvals,
 job_id text NOT NULL CHECK(job_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 sponsor_user_id uuid NOT NULL REFERENCES auth.users,
 organization_id uuid NOT NULL CHECK(organization_id='00000000-0000-4000-8000-000000000001'),
 manifest_version text NOT NULL CHECK(manifest_version='seed-core-cxp-v1'),
 manifest_sha256 text NOT NULL, approved_by_owner oid NOT NULL,
 valid_until timestamptz NOT NULL, disabled_at timestamptz
);
CREATE TABLE demo_flow_writer.server_admissions (
 context_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 scheduler_approval_id uuid NOT NULL REFERENCES demo_flow_writer.scheduler_approvals,
 transport_id uuid NOT NULL REFERENCES demo_flow_writer.transport_approvals,
 run_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), lineage_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 scheduler_snapshot jsonb NOT NULL, transport_snapshot jsonb NOT NULL,
 identity_receipt_id uuid NOT NULL, identity_version text NOT NULL, identity_sha256 text NOT NULL,
 issued_by_owner oid NOT NULL, issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 not_before timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 CHECK(expires_at>not_before)
);
CREATE TRIGGER immutable_admissions BEFORE UPDATE OR DELETE ON demo_flow_writer.server_admissions
 FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
-- Approval rows are configurable only by the already-existing owner. Each future
-- production registration is an explicit authority grant, outside this deliverable.
-- No helper below creates/updates approvals or invents user memberships.

CREATE FUNCTION demo_flow_writer.assert_registry_owner() RETURNS oid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid;
BEGIN
 SELECT proowner INTO STRICT owner_id FROM pg_proc
  WHERE oid='public.seed_demo_organization_core()'::regprocedure;
 IF current_user::regrole::oid<>owner_id OR session_user::regrole::oid<>owner_id THEN
  RAISE EXCEPTION 'DEMO_REGISTRY_EXISTING_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN owner_id;
END $$;

CREATE FUNCTION demo_flow_writer.validated_scheduler(p_approval uuid) RETURNS demo_flow_writer.scheduler_approvals
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE a demo_flow_writer.scheduler_approvals; t demo_flow_writer.transport_approvals; account jsonb; owner_id oid;
BEGIN
 SELECT proowner INTO STRICT owner_id FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure;
 SELECT * INTO STRICT a FROM demo_flow_writer.scheduler_approvals WHERE id=p_approval FOR SHARE;
 SELECT * INTO STRICT t FROM demo_flow_writer.transport_approvals WHERE id=a.transport_id FOR SHARE;
 IF current_user::regrole::oid<>owner_id OR t.owner_oid<>owner_id OR a.approved_by_owner<>owner_id
  OR t.approved_by_owner<>owner_id OR a.organization_id<>t.organization_id
  OR a.disabled_at IS NOT NULL OR t.disabled_at IS NOT NULL
  OR clock_timestamp()>=a.valid_until OR clock_timestamp()>=t.valid_until
  OR a.manifest_sha256 IS DISTINCT FROM demo_flow_writer.manifest_sha256()
  OR a.manifest_version<>'seed-core-cxp-v1' THEN
  RAISE EXCEPTION 'DEMO_SCHEDULER_APPROVAL_INVALID' USING ERRCODE='42501'; END IF;
 SELECT to_jsonb(u) INTO STRICT account FROM auth.users u WHERE u.id=a.sponsor_user_id FOR SHARE;
 -- Fail closed when the recovered account schema cannot express disablement.
 IF NOT (account ? 'deleted_at' AND account ? 'banned_until')
  OR account->>'deleted_at' IS NOT NULL
  OR (account->>'banned_until')::timestamptz>clock_timestamp() THEN
  RAISE EXCEPTION 'DEMO_SPONSOR_ACCOUNT_DISABLED_OR_SCHEMA_UNKNOWN' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.organization_members om WHERE om.user_id=a.sponsor_user_id
  AND om.organization_id=a.organization_id AND om.role::text IN ('super_admin','admin','admin_org') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_SPONSOR_MEMBERSHIP_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.user_roles ur WHERE ur.user_id=a.sponsor_user_id
  AND ur.role::text IN ('super_admin','admin','admin_org') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_SPONSOR_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 PERFORM demo_flow_writer.assert_active_organization();
 RETURN a;
END $$;

-- Concrete registry-issued context; caller chooses only an already-approved policy
-- and already-produced private identity receipt. Run/lineage/principal/actor derived.
-- Owner-only INVOKER means neither service_role RPC nor arbitrary UUID mints authority.
CREATE FUNCTION demo_flow_writer.issue_scheduler_context(p_approval uuid,p_identity_receipt uuid,p_ttl_seconds integer)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid; a demo_flow_writer.scheduler_approvals; t demo_flow_writer.transport_approvals;
 i jsonb; origin jsonb; ctx uuid; issued timestamptz:=clock_timestamp(); deadline timestamptz;
BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 IF p_ttl_seconds IS NULL OR p_ttl_seconds<1 OR p_ttl_seconds>300 THEN
  RAISE EXCEPTION 'DEMO_INVALID_CONTEXT_TTL' USING ERRCODE='22023'; END IF;
 a:=demo_flow_writer.validated_scheduler(p_approval);
 SELECT * INTO STRICT t FROM demo_flow_writer.transport_approvals WHERE id=a.transport_id;
 -- Origin verifier remains independently required; registry cannot synthesize a receipt.
 i:=demo_flow_writer.verify_identity_receipt(p_identity_receipt);
 origin:=demo_fixture_identity.verify_preparation_origin(p_identity_receipt);
 IF i IS NULL OR (i->>'receipt_id')::uuid IS DISTINCT FROM p_identity_receipt
  OR i->>'organization_id' IS DISTINCT FROM a.organization_id::text
  OR i->>'manifest_version' IS DISTINCT FROM a.manifest_version
  OR i->>'manifest_sha256' IS DISTINCT FROM a.manifest_sha256
  OR origin IS NULL
  OR origin->>'scheduler_approval_id' IS DISTINCT FROM a.id::text
  OR origin->'scheduler_snapshot' IS DISTINCT FROM to_jsonb(a)
  OR origin->'transport_snapshot' IS DISTINCT FROM to_jsonb(t) THEN
  RAISE EXCEPTION 'DEMO_REGISTRY_IDENTITY_ORIGIN_CONFLICT' USING ERRCODE='42501'; END IF;
 deadline:=least(issued+make_interval(secs=>p_ttl_seconds),a.valid_until,t.valid_until);
 INSERT INTO demo_flow_writer.server_admissions(scheduler_approval_id,transport_id,scheduler_snapshot,transport_snapshot,identity_receipt_id,
  identity_version,identity_sha256,issued_by_owner,not_before,expires_at)
 VALUES(a.id,t.id,to_jsonb(a),to_jsonb(t),p_identity_receipt,i->>'source_version',i->>'source_sha256',owner_id,issued,deadline)
 RETURNING context_id INTO ctx;
 RETURN ctx;
END $$;

-- This predicate is catalog/ACL-bound, not a bearer UUID or free-form JWT test.
-- It requires an approved existing login + actual SET ROLE + the pinned function owner.
-- Approved policy rows are absent by default. No principal is assumed to exist by name.
CREATE OR REPLACE FUNCTION demo_flow_writer.assert_rpc_transport() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid; selected_role oid;
BEGIN
 SELECT proowner INTO STRICT owner_id FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure;
 selected_role:=to_regrole(current_setting('role',true))::oid;
 IF current_user::regrole::oid<>owner_id OR NOT EXISTS(
  SELECT 1 FROM demo_flow_writer.transport_approvals t
  JOIN pg_roles login ON login.oid=t.login_role_oid
  JOIN pg_roles technical ON technical.oid=t.technical_role_oid
  WHERE t.owner_oid=owner_id AND t.approved_by_owner=owner_id
   AND t.login_role_oid=session_user::regrole::oid AND login.rolcanlogin
   AND technical.rolname='service_role' AND selected_role=technical.oid
   AND t.disabled_at IS NULL AND clock_timestamp()<t.valid_until
   AND coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')=technical.rolname
 ) THEN RAISE EXCEPTION 'DEMO_REGISTERED_RPC_TRANSPORT_REQUIRED' USING ERRCODE='42501'; END IF;
END $$;

CREATE OR REPLACE FUNCTION demo_flow_writer.read_server_context(p_context_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c demo_flow_writer.server_admissions; a demo_flow_writer.scheduler_approvals;
 t demo_flow_writer.transport_approvals;
BEGIN
 PERFORM demo_flow_writer.assert_rpc_transport();
 SELECT * INTO STRICT c FROM demo_flow_writer.server_admissions WHERE context_id=p_context_id FOR SHARE;
 a:=demo_flow_writer.validated_scheduler(c.scheduler_approval_id);
 SELECT * INTO STRICT t FROM demo_flow_writer.transport_approvals WHERE id=c.transport_id FOR SHARE;
 IF c.scheduler_snapshot IS DISTINCT FROM to_jsonb(a) OR c.transport_snapshot IS DISTINCT FROM to_jsonb(t)
   OR c.transport_id<>a.transport_id OR t.login_role_oid<>session_user::regrole::oid
   OR t.technical_role_oid IS DISTINCT FROM to_regrole(current_setting('role',true))::oid
   OR c.issued_by_owner<>t.owner_oid OR clock_timestamp()<c.not_before OR clock_timestamp()>=c.expires_at
   THEN RAISE EXCEPTION 'DEMO_ADMISSION_INVALID' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('context_id',c.context_id,'run_id',c.run_id,'lineage_id',c.lineage_id,
  'organization_id',a.organization_id,'purpose','initial','manifest_version',a.manifest_version,
  'manifest_sha256',a.manifest_sha256,'identity_receipt_id',c.identity_receipt_id,
  'identity_version',c.identity_version,'identity_sha256',c.identity_sha256,
  'session_principal',session_user,'initiator_kind','scheduler','initiator_job_id',a.job_id,
  'initiator_user_id',NULL,'not_before',c.not_before,'expires_at',c.expires_at);
END $$;

CREATE OR REPLACE FUNCTION demo_flow_writer.assert_context_read_access(p_context_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM demo_flow_writer.assert_rpc_transport();
 IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.server_admissions c
  JOIN demo_flow_writer.transport_approvals t ON t.id=c.transport_id
  WHERE c.context_id=p_context_id AND t.login_role_oid=session_user::regrole::oid
   AND t.technical_role_oid=to_regrole(current_setting('role',true))::oid
   AND t.owner_oid=current_user::regrole::oid AND c.issued_by_owner=t.owner_oid
   AND t.disabled_at IS NULL AND clock_timestamp()<t.valid_until)
 THEN RAISE EXCEPTION 'DEMO_CONTEXT_HISTORY_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
