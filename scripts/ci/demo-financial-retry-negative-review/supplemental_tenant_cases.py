"""Supplemental same-context retry after tenant-scoped authority changes.

This does not change the attested tenant.  The common executor must first prove
genuine materialization and an unchanged retry of the sole financial_context,
then save its row snapshot in pg_temp.retry_negative_before_mutation(body jsonb).
The existing sponsor membership is moved to the already existing second tenant;
the original context, scheduler, transport, run, lineage and global role remain.
Only the author-owned disposable laboratory may execute the returned fragments.
"""

from textwrap import dedent


AUTHOR_FIX_HEAD = "a7aff9ff8f92852687c56d3bc05d41150b44b2ae"
BOUNDARY_TAG = "current-tenant-membership"

_DECLARE = """
 v_context uuid;
 v_admission demo_flow_writer.server_admissions;
 v_policy demo_flow_writer.scheduler_approvals;
 v_transport demo_flow_writer.transport_approvals;
 v_run demo_flow_writer.runs;
 v_member public.organization_members;
 v_before_member jsonb;
 v_before_rows jsonb;
 v_roles jsonb;
 v_second_tenant uuid;
 v_changed bigint;
 v_role_attnum text;
"""

_RESOLVE = """
 IF (SELECT count(*) FROM pg_temp.financial_context) <> 1
 OR (SELECT count(*) FROM pg_temp.retry_negative_before_mutation) <> 1 THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_MEASURED_BASELINE_REQUIRED';
 END IF;
 SELECT context_id INTO STRICT v_context FROM pg_temp.financial_context;
 SELECT body INTO STRICT v_before_rows FROM pg_temp.retry_negative_before_mutation;
 SELECT * INTO STRICT v_admission FROM demo_flow_writer.server_admissions
  WHERE context_id=v_context FOR SHARE;
 SELECT * INTO STRICT v_policy FROM demo_flow_writer.scheduler_approvals
  WHERE id=v_admission.scheduler_approval_id FOR SHARE;
 SELECT * INTO STRICT v_transport FROM demo_flow_writer.transport_approvals
  WHERE id=v_admission.transport_id FOR SHARE;
 SELECT * INTO STRICT v_run FROM demo_flow_writer.runs
  WHERE id=v_admission.run_id FOR SHARE;
 IF v_policy.transport_id IS DISTINCT FROM v_transport.id
 OR v_run.lineage_id IS DISTINCT FROM v_admission.lineage_id
 OR v_run.organization_id IS DISTINCT FROM v_policy.organization_id
 OR v_transport.organization_id IS DISTINCT FROM v_policy.organization_id
 OR to_jsonb(v_policy) IS DISTINCT FROM v_admission.scheduler_snapshot
 OR to_jsonb(v_transport) IS DISTINCT FROM v_admission.transport_snapshot
 OR NOT EXISTS (
  SELECT 1 FROM demo_flow_writer.authorization_receipts a
  JOIN demo_flow_writer.execution_receipts x
   ON x.execution_run_id=a.run_id AND x.lineage_id=a.lineage_id
  JOIN demo_flow_writer.seed_checkpoints cp ON cp.id=x.checkpoint_id
  WHERE a.context_id=v_context AND a.run_id=v_run.id
   AND a.lineage_id=v_run.lineage_id AND a.organization_id=v_policy.organization_id
   AND cp.lineage_id=v_run.lineage_id AND cp.projection_sha256=x.projection_sha256
 ) THEN RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_MATERIALIZED_CONTEXT_REQUIRED'; END IF;
 SELECT value INTO STRICT v_before_member
  FROM jsonb_array_elements(v_before_rows->'public.organization_members')
  WHERE value->>'user_id'=v_policy.sponsor_user_id::text
   AND value->>'organization_id'=v_policy.organization_id::text;
 SELECT * INTO STRICT v_member FROM public.organization_members
  WHERE id=(v_before_member->>'id')::uuid FOR UPDATE;
 IF (SELECT count(DISTINCT organization_id) FROM pg_temp.financial_manual_sentinels
     WHERE organization_id<>v_policy.organization_id) <> 1 THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_ONE_EXISTING_ALTERNATE_REQUIRED';
 END IF;
 SELECT DISTINCT organization_id INTO STRICT v_second_tenant
  FROM pg_temp.financial_manual_sentinels WHERE organization_id<>v_policy.organization_id;
 IF NOT EXISTS (SELECT 1 FROM public.organizations
                WHERE id=v_second_tenant AND activo IS TRUE)
 OR NOT EXISTS (SELECT 1 FROM public.organizations
                WHERE id=v_policy.organization_id AND activo IS TRUE) THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_TWO_ACTIVE_EXISTING_TENANTS_REQUIRED';
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(ur) ORDER BY to_jsonb(ur)::text),'[]'::jsonb)
  INTO v_roles FROM public.user_roles ur;
 IF v_roles IS DISTINCT FROM v_before_rows->'public.user_roles'
 OR NOT EXISTS (SELECT 1 FROM public.user_roles
                WHERE user_id=v_policy.sponsor_user_id
                 AND role::text IN ('super_admin','admin','admin_org')) THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_GLOBAL_ROLE_MUST_REMAIN_UNCHANGED';
 END IF;
"""

_TRIGGER_GUARD = """
 -- Organization-only UPDATE preserves all canonical triggers.  Fail closed if
 -- an added/unqualified UPDATE trigger would change this source-level route.
 SELECT attnum::text INTO STRICT v_role_attnum FROM pg_attribute
  WHERE attrelid='public.organization_members'::regclass AND attname='role'
   AND attnum>0 AND NOT attisdropped;
 IF (SELECT array_agg(t.tgname::text ORDER BY t.tgname::text) FROM pg_trigger t
     WHERE t.tgrelid='public.organization_members'::regclass
      AND NOT t.tgisinternal AND (t.tgtype & 16)=16)
 IS DISTINCT FROM ARRAY['trg_bloquear_rol_plataforma_om',
                        'trg_log_role_change_om','trg_sync_user_roles_om_upd']
 OR EXISTS (
  SELECT 1 FROM pg_trigger t
  WHERE t.tgrelid='public.organization_members'::regclass
   AND NOT t.tgisinternal AND (t.tgtype & 16)=16
   AND (t.tgenabled<>'O' OR t.tgattr::text IS DISTINCT FROM v_role_attnum
    OR t.tgfoid IS DISTINCT FROM CASE t.tgname
     WHEN 'trg_bloquear_rol_plataforma_om' THEN 'public._bloquear_rol_plataforma_om()'::regprocedure
     WHEN 'trg_log_role_change_om' THEN 'public._log_role_change_om()'::regprocedure
     WHEN 'trg_sync_user_roles_om_upd' THEN 'public._sync_user_roles_desde_membership()'::regprocedure
    END)
 ) THEN RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_CANONICAL_UPDATE_TRIGGERS_REQUIRED'; END IF;
"""


def _do(body: str) -> str:
    return dedent(
        "DO $retry_supplement_tenant$\nDECLARE\n" + _DECLARE + "BEGIN\n"
        + _RESOLVE + _TRIGGER_GUARD + body
        + "\nEND $retry_supplement_tenant$;\n"
    ).strip()


CASES = (
    {
        "id": "tenant_authority_reassignment",
        "phase": "materialized",
        "category": "tenant_scoped_authority",
        "boundary_tag": BOUNDARY_TAG,
        "rejection_stage": "rpc",
        "description": (
            "Retry the same issued context after moving its sponsor membership to "
            "the existing second tenant. The global admin role stays unchanged; "
            "the attested context tenant does not change."
        ),
        "mutation_sql": _do(
            """
 IF to_jsonb(v_member) IS DISTINCT FROM v_before_member
 OR v_member.user_id IS DISTINCT FROM v_policy.sponsor_user_id
 OR v_member.organization_id IS DISTINCT FROM v_policy.organization_id
 OR v_member.role::text NOT IN ('super_admin','admin','admin_org')
 OR (SELECT count(*) FROM public.organization_members
     WHERE user_id=v_policy.sponsor_user_id) <> 1
 OR EXISTS (SELECT 1 FROM public.organization_members
            WHERE user_id=v_policy.sponsor_user_id AND organization_id=v_second_tenant)
 OR v_policy.disabled_at IS NOT NULL OR v_transport.disabled_at IS NOT NULL
 OR clock_timestamp()>=v_policy.valid_until OR clock_timestamp()>=v_transport.valid_until
 OR clock_timestamp()<v_admission.not_before OR clock_timestamp()>=v_admission.expires_at
 OR v_run.revoked_at IS NOT NULL OR clock_timestamp()>=v_run.expires_at THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_UNCHANGED_LIVE_MEMBERSHIP_REQUIRED';
 END IF;
 UPDATE public.organization_members
  SET organization_id=v_second_tenant
  WHERE id=v_member.id AND user_id=v_policy.sponsor_user_id
   AND organization_id=v_policy.organization_id;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>1 THEN RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_UPDATE_CARDINALITY'; END IF;
"""
        ),
        "expected_sqlstate": "42501",
        "expected_message": "DEMO_SPONSOR_MEMBERSHIP_REQUIRED",
        "proof_sql": _do(
            """
 IF (v_member.organization_id=v_second_tenant
  AND v_member.user_id=v_policy.sponsor_user_id
  AND (to_jsonb(v_member)-'organization_id') IS NOT DISTINCT FROM
      (v_before_member-'organization_id')
  AND (SELECT count(*) FROM public.organization_members
       WHERE user_id=v_policy.sponsor_user_id AND organization_id=v_second_tenant
        AND role::text IN ('super_admin','admin','admin_org'))=1
  AND NOT EXISTS (SELECT 1 FROM public.organization_members
                  WHERE user_id=v_policy.sponsor_user_id
                   AND organization_id=v_policy.organization_id)
  AND v_run.organization_id=v_policy.organization_id
  AND EXISTS (SELECT 1 FROM demo_flow_writer.lineages l
              WHERE l.id=v_run.lineage_id AND l.organization_id=v_policy.organization_id)
 ) IS NOT TRUE THEN
  RAISE EXCEPTION 'RETRY_SUPPLEMENT_TENANT_REASSIGNMENT_NOT_REACHED';
 END IF;
"""
        ),
        "source_evidence": (
            "Unchanged flow/issuer/16-owner-registry.sql at author fix " + AUTHOR_FIX_HEAD
            + ": read_server_context calls validated_scheduler, whose original-tenant "
            "organization_members predicate raises DEMO_SPONSOR_MEMBERSHIP_REQUIRED "
            "before the independent user_roles check. baseline.sql membership UPDATE "
            "triggers are qualified by role; its organization FK accepts the existing tenant."
        ),
        "requires": (
            "Common genuine-materialization and unchanged same-context retry control",
            "Common pg_temp.retry_negative_before_mutation row snapshot",
            "Exactly one existing sponsor membership and one measured second tenant",
            "Author-owned synthetic owner execution; this is not application RLS evidence",
        ),
    },
)


BLOCKED_CASES = (
    {
        "id": "supplemental_attested_tenant_identity_switch",
        "phase": "materialized",
        "category": "tenant_identity",
        "status": "BLOCKED",
        "reason": (
            "The legal membership reassignment tests loss of authority for the context's "
            "original tenant. It cannot turn that context into another tenant's context: "
            "tenant CHECKs and immutable admission/run/lineage provenance prevent that "
            "transition. No second tenant context or real external caller authentication "
            "is provided by the existing fixture."
        ),
    },
)
