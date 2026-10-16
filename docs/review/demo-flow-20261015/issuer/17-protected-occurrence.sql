-- PROPOSED REVIEW-ONLY, NOT A MIGRATION. NOT_ADMITTED. No configured rows,
-- credentials, roles, grants, endpoint or runtime activation. Install after the
-- unchanged SQL16 and authentic producer/receipt bridge, as the existing owner.
BEGIN;
DO $$ BEGIN
 PERFORM demo_flow_writer.assert_registry_owner();
 IF (SELECT nspowner FROM pg_namespace WHERE nspname='demo_flow_writer') IS DISTINCT FROM current_user::regrole::oid THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_SCHEMA_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
END $$;

CREATE TABLE demo_flow_writer.authority_fences (
 deployment text PRIMARY KEY CHECK(length(deployment) BETWEEN 1 AND 256 AND deployment=btrim(deployment) AND deployment !~ '[[:cntrl:]]'),
 generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 fence text NOT NULL CHECK(length(fence) BETWEEN 1 AND 256 AND fence=btrim(fence) AND fence !~ '[[:cntrl:]]'),
 stopped boolean NOT NULL DEFAULT true,
 reviewed_by_owner oid NOT NULL,
 review_reference text NOT NULL CHECK(length(btrim(review_reference))>0)
);
-- No row means STOPPED. No helper here activates a deployment or advances a fence.
-- A fence stored in this same database cannot certify recovery after full restore.
CREATE TABLE demo_flow_writer.protected_occurrences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 deployment text NOT NULL REFERENCES demo_flow_writer.authority_fences(deployment),
 organization_id uuid NOT NULL CHECK(organization_id='00000000-0000-4000-8000-000000000001'),
 manifest_identity text NOT NULL CHECK(length(manifest_identity) BETWEEN 1 AND 256 AND manifest_identity=btrim(manifest_identity) AND manifest_identity !~ '[[:cntrl:]]'),
 scheduler_approval_id uuid NOT NULL REFERENCES demo_flow_writer.scheduler_approvals(id),
 scheduler_job text NOT NULL CHECK(scheduler_job ~ '^[a-zA-Z0-9_-]{1,100}$'),
 authorized_occurrence text NOT NULL CHECK(length(authorized_occurrence) BETWEEN 1 AND 256 AND authorized_occurrence=btrim(authorized_occurrence) AND authorized_occurrence !~ '[[:cntrl:]]'),
 preparation_admission_id uuid NOT NULL REFERENCES demo_fixture_identity.preparation_admissions(id),
 receipt_id uuid NOT NULL REFERENCES demo_fixture_identity.prepared_receipts(receipt_id),
 skip_ms bigint NOT NULL CHECK(skip_ms BETWEEN 0 AND 9007199254740991),
 generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 restore_fence text NOT NULL,
 not_before timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at>not_before),
 approved_by_owner oid NOT NULL,
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference))>0),
 -- The semantic family + explicit occurrence is stable across artifact, generation,
 -- receipt and TTL changes. None of those values can regenerate the natural key.
 UNIQUE(deployment,organization_id,manifest_identity,scheduler_job,authorized_occurrence)
);
CREATE TABLE demo_flow_writer.occurrence_context_bindings (
 authority_id uuid PRIMARY KEY REFERENCES demo_flow_writer.protected_occurrences(id),
 context_id uuid NOT NULL UNIQUE REFERENCES demo_flow_writer.server_admissions(context_id),
 bound_by_owner oid NOT NULL
);
CREATE TABLE demo_flow_writer.occurrence_revocations (
 authority_id uuid PRIMARY KEY REFERENCES demo_flow_writer.protected_occurrences(id),
 revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_by_owner oid NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason))>0)
);
CREATE TRIGGER immutable_occurrence BEFORE UPDATE OR DELETE ON demo_flow_writer.protected_occurrences FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_occurrence_truncate BEFORE TRUNCATE ON demo_flow_writer.protected_occurrences FOR EACH STATEMENT EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_context_binding BEFORE UPDATE OR DELETE ON demo_flow_writer.occurrence_context_bindings FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_binding_truncate BEFORE TRUNCATE ON demo_flow_writer.occurrence_context_bindings FOR EACH STATEMENT EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_revocation BEFORE UPDATE OR DELETE ON demo_flow_writer.occurrence_revocations FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_revocation_truncate BEFORE TRUNCATE ON demo_flow_writer.occurrence_revocations FOR EACH STATEMENT EXECUTE FUNCTION demo_flow_writer.immutable();

-- Reject unrepresentable source instants, never round a permission boundary.
CREATE FUNCTION demo_flow_writer.authority_instant(p_value timestamptz) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF p_value IS NULL OR NOT isfinite(p_value) OR p_value<>date_trunc('milliseconds',p_value)
  OR extract(year FROM p_value AT TIME ZONE 'UTC') NOT BETWEEN 1 AND 9999 THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_TIMESTAMP_PRECISION' USING ERRCODE='22023'; END IF;
 RETURN to_char(p_value AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
END $$;

CREATE FUNCTION demo_flow_writer.lock_occurrence_revocation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid; BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 -- Even a direct owner INSERT takes the same authority-row lock as read/issue.
 PERFORM 1 FROM demo_flow_writer.protected_occurrences WHERE id=NEW.authority_id FOR UPDATE;
 IF NOT FOUND OR NEW.revoked_by_owner IS DISTINCT FROM owner_id THEN
  RAISE EXCEPTION 'DEMO_REVOCATION_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER serialize_occurrence_revocation BEFORE INSERT ON demo_flow_writer.occurrence_revocations FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.lock_occurrence_revocation();

CREATE FUNCTION demo_flow_writer.checked_occurrence(p_authority uuid)
RETURNS demo_flow_writer.protected_occurrences LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE u demo_flow_writer.protected_occurrences; f demo_flow_writer.authority_fences;
 a demo_flow_writer.scheduler_approvals; t demo_flow_writer.transport_approvals;
 p demo_fixture_identity.preparation_admissions; o jsonb; i jsonb; owner_id oid; dep text;
BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_READ_COMMITTED_REQUIRED' USING ERRCODE='25001'; END IF;
 SELECT deployment INTO STRICT dep FROM demo_flow_writer.protected_occurrences WHERE id=p_authority;
 SELECT * INTO STRICT f FROM demo_flow_writer.authority_fences WHERE deployment=dep FOR SHARE;
 -- FOR UPDATE deliberately serializes binding/reader/revocation, held to TX end.
 SELECT * INTO STRICT u FROM demo_flow_writer.protected_occurrences WHERE id=p_authority FOR UPDATE;
 IF f.stopped OR f.reviewed_by_owner<>owner_id OR u.approved_by_owner<>owner_id
  OR u.deployment<>f.deployment OR u.generation<>f.generation OR u.restore_fence<>f.fence THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_FENCE_HOLD' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM demo_flow_writer.protected_occurrences x WHERE x.deployment=u.deployment AND x.organization_id=u.organization_id AND x.manifest_identity=u.manifest_identity AND x.scheduler_job=u.scheduler_job AND x.authorized_occurrence=u.authorized_occurrence)<>1 THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_AMBIGUOUS' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM demo_flow_writer.occurrence_revocations WHERE authority_id=u.id) THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_REVOKED' USING ERRCODE='42501'; END IF;
 IF clock_timestamp()<u.not_before OR clock_timestamp()>=u.expires_at THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_EXPIRED_OR_EARLY' USING ERRCODE='42501'; END IF;
 PERFORM demo_flow_writer.authority_instant(u.not_before),demo_flow_writer.authority_instant(u.expires_at);
 a:=demo_flow_writer.validated_scheduler(u.scheduler_approval_id);
 SELECT * INTO STRICT t FROM demo_flow_writer.transport_approvals WHERE id=a.transport_id FOR SHARE;
 SELECT * INTO STRICT p FROM demo_fixture_identity.preparation_admissions WHERE id=u.preparation_admission_id FOR SHARE;
 -- Original producer and receipt validators, unchanged. Their catalog, snapshot,
 -- tenant, active membership and entity locks remain part of this transaction.
 o:=demo_fixture_identity.verify_preparation_origin(u.receipt_id);
 i:=demo_flow_writer.verify_identity_receipt(u.receipt_id);
 IF a.organization_id<>u.organization_id OR a.job_id<>u.scheduler_job
  OR p.scheduler_approval_id<>a.id OR p.admitted_by_owner<>owner_id
  OR p.scheduler_snapshot IS DISTINCT FROM to_jsonb(a) OR p.transport_snapshot IS DISTINCT FROM to_jsonb(t)
  OR o->>'admission_id' IS DISTINCT FROM p.id::text OR o->>'receipt_id' IS DISTINCT FROM u.receipt_id::text
  OR o->>'scheduler_approval_id' IS DISTINCT FROM a.id::text
  OR i->>'organization_id' IS DISTINCT FROM u.organization_id::text
  OR i->>'manifest_version' IS DISTINCT FROM a.manifest_version
  OR i->>'manifest_sha256' IS DISTINCT FROM a.manifest_sha256 THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_REFERENCE_CONFLICT' USING ERRCODE='42501'; END IF;
 PERFORM demo_flow_writer.authority_instant(a.valid_until),demo_flow_writer.authority_instant(t.valid_until),demo_flow_writer.authority_instant(p.valid_until);
 RETURN u;
END $$;

CREATE FUNCTION demo_flow_writer.register_occurrence(p_deployment text,p_manifest_identity text,
 p_occurrence text,p_preparation uuid,p_receipt uuid,p_skip_ms bigint,p_not_before timestamptz,
 p_expires_at timestamptz,p_approval_reference text) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid; f demo_flow_writer.authority_fences; p demo_fixture_identity.preparation_admissions;
 a demo_flow_writer.scheduler_approvals; result uuid;
BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 SELECT * INTO STRICT f FROM demo_flow_writer.authority_fences WHERE deployment=p_deployment FOR SHARE;
 IF f.stopped OR f.reviewed_by_owner<>owner_id THEN RAISE EXCEPTION 'DEMO_AUTHORITY_FENCE_HOLD' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT p FROM demo_fixture_identity.preparation_admissions WHERE id=p_preparation FOR SHARE;
 a:=demo_flow_writer.validated_scheduler(p.scheduler_approval_id);
 INSERT INTO demo_flow_writer.protected_occurrences(deployment,organization_id,manifest_identity,
 scheduler_approval_id,scheduler_job,authorized_occurrence,preparation_admission_id,receipt_id,skip_ms,
 generation,restore_fence,not_before,expires_at,approved_by_owner,approval_reference)
 VALUES(f.deployment,a.organization_id,p_manifest_identity,a.id,a.job_id,p_occurrence,p.id,p_receipt,p_skip_ms,
 f.generation,f.fence,p_not_before,p_expires_at,owner_id,p_approval_reference) RETURNING id INTO result;
 PERFORM demo_flow_writer.checked_occurrence(result);
 RETURN result;
END $$;
CREATE FUNCTION demo_flow_writer.revoke_occurrence(p_authority uuid,p_reason text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid; BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 PERFORM 1 FROM demo_flow_writer.protected_occurrences WHERE id=p_authority FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_AUTHORITY_MISSING' USING ERRCODE='42501'; END IF;
 INSERT INTO demo_flow_writer.occurrence_revocations(authority_id,revoked_by_owner,reason)
 VALUES(p_authority,owner_id,p_reason);
END $$;

-- Close inherited grants on NEW objects only, including non-application roles.
DO $$ DECLARE o record; g record; recipient text; BEGIN
 FOR o IN SELECT c.relowner owner_id,c.relacl acl,'r'::"char" kind,'TABLE '||c.oid::regclass::text target
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='demo_flow_writer'
 AND c.relname IN('authority_fences','protected_occurrences','occurrence_context_bindings','occurrence_revocations')
 UNION ALL SELECT p.proowner,p.proacl,'f'::"char",'FUNCTION '||p.oid::regprocedure::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='demo_flow_writer'
 AND p.proname IN('authority_instant','lock_occurrence_revocation','checked_occurrence','register_occurrence','revoke_occurrence')
 LOOP
  FOR g IN SELECT DISTINCT grantee FROM aclexplode(coalesce(o.acl,acldefault(o.kind,o.owner_id))) WHERE grantee<>o.owner_id LOOP
   recipient:=CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(g.grantee)) END;
   EXECUTE 'REVOKE ALL PRIVILEGES ON '||o.target||' FROM '||recipient||' CASCADE';
  END LOOP;
 END LOOP;
END $$;
COMMIT;
