-- PROPOSED REVIEW-ONLY, NOT_ADMITTED. Direct owner issuer projection, NOT an RPC
-- transport, dispatch, ingress or business guard. Does not replace SQL16.
BEGIN;
DO $$ BEGIN PERFORM demo_flow_writer.assert_registry_owner(); END $$;
CREATE FUNCTION demo_flow_writer.authority_scheduler_json(p demo_flow_writer.scheduler_approvals) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',(p).id,'transportId',(p).transport_id,'jobId',(p).job_id,'sponsorUserId',(p).sponsor_user_id,
 'tenant',(p).organization_id,'manifestVersion',(p).manifest_version,'manifestSha256',(p).manifest_sha256,
 'approvedByOwner',(p).approved_by_owner::bigint,'validUntil',demo_flow_writer.authority_instant((p).valid_until),
 'disabledAt',CASE WHEN (p).disabled_at IS NULL THEN NULL ELSE demo_flow_writer.authority_instant((p).disabled_at) END)
$$;
CREATE FUNCTION demo_flow_writer.authority_transport_json(p demo_flow_writer.transport_approvals) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',(p).id,'ownerOid',(p).owner_oid::bigint,'loginRoleOid',(p).login_role_oid::bigint,
 'technicalRoleOid',(p).technical_role_oid::bigint,'tenant',(p).organization_id,'approvedByOwner',(p).approved_by_owner::bigint,
 'validUntil',demo_flow_writer.authority_instant((p).valid_until),
 'disabledAt',CASE WHEN (p).disabled_at IS NULL THEN NULL ELSE demo_flow_writer.authority_instant((p).disabled_at) END)
$$;
CREATE FUNCTION demo_flow_writer.read_authority(p_context uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE u demo_flow_writer.protected_occurrences; b demo_flow_writer.occurrence_context_bindings;
 a demo_flow_writer.scheduler_approvals; t demo_flow_writer.transport_approvals;
 p demo_fixture_identity.preparation_admissions; r demo_fixture_identity.preparation_runs;
 c demo_flow_writer.server_admissions; owner_id oid; aid uuid; sj jsonb; tj jsonb; observed timestamptz; result jsonb;
BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 SELECT authority_id INTO STRICT aid FROM demo_flow_writer.occurrence_context_bindings WHERE context_id=p_context;
 u:=demo_flow_writer.checked_occurrence(aid);
 SELECT * INTO STRICT b FROM demo_flow_writer.occurrence_context_bindings WHERE authority_id=u.id FOR SHARE;
 SELECT * INTO STRICT c FROM demo_flow_writer.server_admissions WHERE context_id=b.context_id FOR SHARE;
 SELECT * INTO STRICT a FROM demo_flow_writer.scheduler_approvals WHERE id=u.scheduler_approval_id FOR SHARE;
 SELECT * INTO STRICT t FROM demo_flow_writer.transport_approvals WHERE id=a.transport_id FOR SHARE;
 SELECT * INTO STRICT p FROM demo_fixture_identity.preparation_admissions WHERE id=u.preparation_admission_id FOR SHARE;
 SELECT * INTO STRICT r FROM demo_fixture_identity.preparation_runs WHERE admission_id=p.id AND receipt_id=u.receipt_id FOR SHARE;
 IF b.context_id<>p_context OR b.bound_by_owner<>owner_id OR c.issued_by_owner<>owner_id
  OR c.scheduler_approval_id<>a.id OR c.transport_id<>t.id OR c.identity_receipt_id<>u.receipt_id
  OR c.scheduler_snapshot IS DISTINCT FROM to_jsonb(a) OR c.transport_snapshot IS DISTINCT FROM to_jsonb(t)
  OR c.identity_version<>r.source_version OR c.identity_sha256<>r.source_sha256
  OR c.not_before<u.not_before OR c.not_before>c.issued_at OR c.issued_at>=c.expires_at
  OR c.expires_at>u.expires_at OR c.expires_at>a.valid_until OR c.expires_at>t.valid_until OR c.expires_at>p.valid_until
  OR c.expires_at-c.not_before>interval '300 seconds'
  OR clock_timestamp()<c.issued_at OR clock_timestamp()>=c.expires_at THEN
  RAISE EXCEPTION 'DEMO_BOUND_CONTEXT_CONFLICT_OR_EXPIRED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=t.login_role_oid AND rolcanlogin)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=t.technical_role_oid AND rolname='service_role') THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_PRINCIPAL_MISSING' USING ERRCODE='42501'; END IF;
 sj:=demo_flow_writer.authority_scheduler_json(a); tj:=demo_flow_writer.authority_transport_json(t);
 -- Only the observation is represented at ms resolution; all authorization tests
 -- above and below use unrounded PostgreSQL clock_timestamp(). Source bounds are exact.
 observed:=date_trunc('milliseconds',clock_timestamp());
 result:=jsonb_build_object('schemaVersion',1,'declaration','PREVERIFIED_PROJECTIONS_NOT_AUTHENTICATION',
 'deployment',u.deployment,'observedAt',demo_flow_writer.authority_instant(observed),
 'restoreState',jsonb_build_object('deployment',u.deployment,'generation',u.generation,'fence',u.restore_fence),
 'schedulerApproval',sj,'transportApproval',tj,
 'preparationAdmission',jsonb_build_object('id',p.id,'schedulerApprovalId',p.scheduler_approval_id,
 'schedulerSnapshot',sj,'transportSnapshot',tj,'admittedByOwner',p.admitted_by_owner::bigint,
 'reviewReference',p.review_reference,'originKind',p.origin_kind,'validUntil',demo_flow_writer.authority_instant(p.valid_until)),
 'preparationRun',jsonb_build_object('id',r.id,'admissionId',r.admission_id,'receiptId',r.receipt_id,
 'schedulerApprovalId',r.scheduler_approval_id,'producedByOwner',r.produced_by_owner::bigint,
 'initiatorKind',r.initiator_kind,'initiatorJobId',r.initiator_job_id,'tenant',r.organization_id,
 'manifestVersion',r.manifest_version,'manifestSha256',r.manifest_sha256,'sourceVersion',r.source_version,
 'sourceSha256',r.source_sha256,'clientBindingsSha256',r.client_bindings_sha256),
 'receipt',jsonb_build_object('id',r.receipt_id,'sourceRunId',r.id,'tenant',r.organization_id,
 'manifestVersion',r.manifest_version,'manifestSha256',r.manifest_sha256,'sourceVersion',r.source_version,
 'sourceSha256',r.source_sha256,'clientBindingsSha256',r.client_bindings_sha256),
 'serverAdmission',jsonb_build_object('contextId',c.context_id,'schedulerApprovalId',c.scheduler_approval_id,
 'transportId',c.transport_id,'runId',c.run_id,'lineageId',c.lineage_id,'schedulerSnapshot',sj,'transportSnapshot',tj,
 'identityReceiptId',c.identity_receipt_id,'identityVersion',c.identity_version,'identitySha256',c.identity_sha256,
 'issuedByOwner',c.issued_by_owner::bigint,'issuedAt',demo_flow_writer.authority_instant(c.issued_at),
 'notBefore',demo_flow_writer.authority_instant(c.not_before),'expiresAt',demo_flow_writer.authority_instant(c.expires_at)),
 'serverContext',jsonb_build_object('contextId',c.context_id,'runId',c.run_id,'lineageId',c.lineage_id,
 'tenant',a.organization_id,'purpose','initial','manifestVersion',a.manifest_version,'manifestSha256',a.manifest_sha256,
 'identityReceiptId',c.identity_receipt_id,'identityVersion',c.identity_version,'identitySha256',c.identity_sha256,
 -- This is the registry-approved delegated principal, not proof of an RPC login.
 'sessionPrincipal',pg_get_userbyid(t.login_role_oid),'initiatorKind','scheduler','initiatorJobId',a.job_id,
 'initiatorUserId',NULL,'notBefore',demo_flow_writer.authority_instant(c.not_before),'expiresAt',demo_flow_writer.authority_instant(c.expires_at)),
 'protectedAuthority',jsonb_build_object('recordId',u.id::text,'deployment',u.deployment,'tenant',u.organization_id,
 'manifestIdentity',u.manifest_identity,'schedulerApprovalId',u.scheduler_approval_id,'schedulerJob',u.scheduler_job,
 'authorizedOccurrence',u.authorized_occurrence,'preparationAdmissionId',u.preparation_admission_id,'receiptId',u.receipt_id,
 'skipMs',u.skip_ms,'generation',u.generation,'restoreFence',u.restore_fence,
 'notBefore',demo_flow_writer.authority_instant(u.not_before),'expiresAt',demo_flow_writer.authority_instant(u.expires_at),'revokedAt',NULL));
 -- Revalidate time after building JSON. Reader success is not dispatch authority.
 IF clock_timestamp()>=least(c.expires_at,u.expires_at,a.valid_until,t.valid_until,p.valid_until) THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_EXPIRED_AT_RETURN' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION demo_flow_writer.issue_bound_context(p_authority uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid; u demo_flow_writer.protected_occurrences; a demo_flow_writer.scheduler_approvals;
 t demo_flow_writer.transport_approvals; p demo_fixture_identity.preparation_admissions;
 r demo_fixture_identity.preparation_runs; ctx uuid; tick timestamptz; deadline timestamptz;
BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 u:=demo_flow_writer.checked_occurrence(p_authority);
 SELECT context_id INTO ctx FROM demo_flow_writer.occurrence_context_bindings WHERE authority_id=u.id FOR SHARE;
 IF FOUND THEN
  PERFORM demo_flow_writer.read_authority(ctx);
  RETURN ctx; -- An expired/revoked binding fails. Never replace it or extend TTL.
 END IF;
 SELECT * INTO STRICT a FROM demo_flow_writer.scheduler_approvals WHERE id=u.scheduler_approval_id FOR SHARE;
 SELECT * INTO STRICT t FROM demo_flow_writer.transport_approvals WHERE id=a.transport_id FOR SHARE;
 SELECT * INTO STRICT p FROM demo_fixture_identity.preparation_admissions WHERE id=u.preparation_admission_id FOR SHARE;
 SELECT * INTO STRICT r FROM demo_fixture_identity.preparation_runs WHERE receipt_id=u.receipt_id FOR SHARE;
 -- New issuance defines a millisecond clock tick. This is not normalization of an
 -- existing record. Max TTL starts at this tick (up to <1ms earlier than actual
 -- issue time), therefore never extends the 300s cap or any protected boundary.
 tick:=greatest(u.not_before,date_trunc('milliseconds',clock_timestamp()));
 deadline:=least(tick+interval '300 seconds',u.expires_at,a.valid_until,t.valid_until,p.valid_until);
 IF clock_timestamp()<tick OR clock_timestamp()>=deadline THEN
  RAISE EXCEPTION 'DEMO_AUTHORITY_NO_CONTEXT_WINDOW' USING ERRCODE='42501'; END IF;
 INSERT INTO demo_flow_writer.server_admissions(scheduler_approval_id,transport_id,scheduler_snapshot,transport_snapshot,
 identity_receipt_id,identity_version,identity_sha256,issued_by_owner,issued_at,not_before,expires_at)
 VALUES(a.id,t.id,to_jsonb(a),to_jsonb(t),u.receipt_id,r.source_version,r.source_sha256,owner_id,tick,tick,deadline)
 RETURNING context_id INTO ctx;
 INSERT INTO demo_flow_writer.occurrence_context_bindings(authority_id,context_id,bound_by_owner) VALUES(u.id,ctx,owner_id);
 PERFORM demo_flow_writer.read_authority(ctx);
 RETURN ctx;
END $$;
DO $$ DECLARE o record; g record; recipient text; BEGIN
 FOR o IN SELECT p.proowner owner_id,p.proacl acl,'FUNCTION '||p.oid::regprocedure::text target
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='demo_flow_writer'
 AND p.proname IN('authority_scheduler_json','authority_transport_json','read_authority','issue_bound_context') LOOP
  FOR g IN SELECT DISTINCT grantee FROM aclexplode(coalesce(o.acl,acldefault('f',o.owner_id))) WHERE grantee<>o.owner_id LOOP
   recipient:=CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(g.grantee)) END;
   EXECUTE 'REVOKE ALL PRIVILEGES ON '||o.target||' FROM '||recipient||' CASCADE';
  END LOOP;
 END LOOP;
END $$;
COMMIT;
