"""Review-only retry denials derived from existing, measured authority rows.

The common executor must first materialize the context in
``pg_temp.financial_context`` and prove an unchanged retry succeeds.  It then
executes each case in its own transaction, verifies the mutation outside the
expected-error handler, calls the same RPC, compares persistent snapshots, and
rolls back.  These fragments do not connect to a database or install objects.

``guarded_tenant_run_rebinding`` is an explicit exception to the RPC step: its
expected rejection is the existing BEFORE UPDATE provenance trigger.  It proves
that guard boundary only, not that a changed tenant reaches the retry verifier.
"""

from textwrap import dedent


_DECLARATIONS = """
    v_context uuid;
    v_admission demo_flow_writer.server_admissions;
    v_policy demo_flow_writer.scheduler_approvals;
    v_transport demo_flow_writer.transport_approvals;
    v_run demo_flow_writer.runs;
    v_other_tenant uuid;
    v_changed bigint;
    v_expiry timestamptz;
"""

_RESOLVE = """
    IF (SELECT count(*) FROM pg_temp.financial_context) <> 1 THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_CONTEXT_CARDINALITY';
    END IF;
    SELECT context_id INTO STRICT v_context FROM pg_temp.financial_context;
    SELECT * INTO STRICT v_admission
      FROM demo_flow_writer.server_admissions
      WHERE context_id = v_context FOR SHARE;
    SELECT * INTO STRICT v_policy
      FROM demo_flow_writer.scheduler_approvals
      WHERE id = v_admission.scheduler_approval_id FOR SHARE;
    SELECT * INTO STRICT v_transport
      FROM demo_flow_writer.transport_approvals
      WHERE id = v_admission.transport_id FOR SHARE;
    SELECT * INTO STRICT v_run
      FROM demo_flow_writer.runs
      WHERE id = v_admission.run_id FOR SHARE;
    IF v_policy.transport_id IS DISTINCT FROM v_transport.id
      OR v_run.lineage_id IS DISTINCT FROM v_admission.lineage_id
      OR v_policy.organization_id IS DISTINCT FROM v_transport.organization_id
      OR v_run.organization_id IS DISTINCT FROM v_policy.organization_id
      OR NOT EXISTS (
        SELECT 1 FROM demo_flow_writer.authorization_receipts a
        JOIN demo_flow_writer.execution_receipts x
          ON x.execution_run_id = a.run_id AND x.lineage_id = a.lineage_id
        JOIN demo_flow_writer.seed_checkpoints cp ON cp.id = x.checkpoint_id
        WHERE a.context_id = v_context AND a.run_id = v_run.id
          AND a.lineage_id = v_run.lineage_id
          AND cp.lineage_id = v_run.lineage_id
          AND cp.projection_sha256 = x.projection_sha256
      ) THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_MATERIALIZED_CONTEXT_REQUIRED';
    END IF;
"""

_LIVE_PRECONDITIONS = """
    IF to_jsonb(v_policy) IS DISTINCT FROM v_admission.scheduler_snapshot
      OR to_jsonb(v_transport) IS DISTINCT FROM v_admission.transport_snapshot
      OR v_policy.disabled_at IS NOT NULL OR v_transport.disabled_at IS NOT NULL
      OR clock_timestamp() >= v_policy.valid_until
      OR clock_timestamp() >= v_transport.valid_until
      OR v_policy.manifest_sha256 IS DISTINCT FROM demo_flow_writer.manifest_sha256()
      OR clock_timestamp() < v_admission.not_before
      OR clock_timestamp() >= v_admission.expires_at
      OR v_run.revoked_at IS NOT NULL
      OR v_run.not_before IS DISTINCT FROM v_admission.not_before
      OR v_run.issued_expires_at IS DISTINCT FROM v_admission.expires_at
      OR v_run.expires_at IS DISTINCT FROM v_run.issued_expires_at
      OR clock_timestamp() < v_run.not_before
      OR clock_timestamp() >= v_run.expires_at
      OR (SELECT count(*) FROM public.organizations o
          WHERE o.id = v_run.organization_id AND o.activo IS TRUE) <> 1 THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_LIVE_BASELINE_REQUIRED';
    END IF;
"""


def _do(body: str, *, live: bool = False) -> str:
    """Return a complete statement; precondition errors are never expected denials."""
    return dedent(
        "DO $retry_negative_authority$\nDECLARE\n"
        + _DECLARATIONS
        + "BEGIN\n"
        + _RESOLVE
        + (_LIVE_PRECONDITIONS if live else "")
        + body
        + "\nEND $retry_negative_authority$;\n"
    ).strip()


def _mutation(body: str) -> str:
    return _do(
        body
        + """
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed <> 1 THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_MUTATION_CARDINALITY';
    END IF;
""",
        live=True,
    )


def _proof(predicate: str, case_id: str) -> str:
    return _do(
        f"""
    IF ({predicate}) IS NOT TRUE THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_PROOF_FAILED_{case_id}';
    END IF;
"""
    )


CASES = (
    {
        "id": "authority_scheduler_disabled",
        "phase": "materialized",
        "category": "authority",
        "rejection_stage": "rpc",
        "description": "Disable the measured scheduler delegation after a successful retry.",
        "mutation_sql": _mutation(
            """
    UPDATE demo_flow_writer.scheduler_approvals
      SET disabled_at = clock_timestamp()
      WHERE id = v_policy.id AND disabled_at IS NULL;
"""
        ),
        "expected_sqlstate": "42501",
        "expected_message": "DEMO_SCHEDULER_APPROVAL_INVALID",
        "proof_sql": _proof(
            """
      v_policy.disabled_at IS NOT NULL
      AND (to_jsonb(v_policy) - 'disabled_at') IS NOT DISTINCT FROM
          (v_admission.scheduler_snapshot - 'disabled_at')
      AND to_jsonb(v_transport) IS NOT DISTINCT FROM v_admission.transport_snapshot
""",
            "authority_scheduler_disabled",
        ),
        "source_evidence": (
            "flow/issuer/16-owner-registry.sql: validated_scheduler checks disabled_at "
            "before read_server_context can reuse an existing authorization"
        ),
    },
    {
        "id": "authority_transport_disabled",
        "phase": "materialized",
        "category": "authority",
        "rejection_stage": "rpc",
        "description": "Disable the sole existing transport that can attest this session.",
        "mutation_sql": _mutation(
            """
    IF (SELECT count(*) FROM demo_flow_writer.transport_approvals t
        JOIN pg_roles login ON login.oid = t.login_role_oid
        JOIN pg_roles technical ON technical.oid = t.technical_role_oid
        WHERE t.owner_oid = v_transport.owner_oid
          AND t.approved_by_owner = v_transport.owner_oid
          AND t.login_role_oid = session_user::regrole::oid AND login.rolcanlogin
          AND technical.rolname = 'service_role'
          AND t.technical_role_oid = v_transport.technical_role_oid
          AND t.disabled_at IS NULL AND clock_timestamp() < t.valid_until) <> 1 THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_SOLE_TRANSPORT_REQUIRED';
    END IF;
    UPDATE demo_flow_writer.transport_approvals
      SET disabled_at = clock_timestamp()
      WHERE id = v_transport.id AND disabled_at IS NULL;
"""
        ),
        "expected_sqlstate": "42501",
        "expected_message": "DEMO_REGISTERED_RPC_TRANSPORT_REQUIRED",
        "proof_sql": _proof(
            """
      v_transport.disabled_at IS NOT NULL
      AND (to_jsonb(v_transport) - 'disabled_at') IS NOT DISTINCT FROM
          (v_admission.transport_snapshot - 'disabled_at')
      AND to_jsonb(v_policy) IS NOT DISTINCT FROM v_admission.scheduler_snapshot
      AND NOT EXISTS (
        SELECT 1 FROM demo_flow_writer.transport_approvals t
        JOIN pg_roles login ON login.oid = t.login_role_oid
        JOIN pg_roles technical ON technical.oid = t.technical_role_oid
        WHERE t.owner_oid = v_transport.owner_oid
          AND t.approved_by_owner = v_transport.owner_oid
          AND t.login_role_oid = session_user::regrole::oid AND login.rolcanlogin
          AND technical.rolname = 'service_role'
          AND t.technical_role_oid = v_transport.technical_role_oid
          AND t.disabled_at IS NULL AND clock_timestamp() < t.valid_until
      )
""",
            "authority_transport_disabled",
        ),
        "source_evidence": (
            "flow/issuer/16-owner-registry.sql: assert_rpc_transport requires an "
            "enabled, unexpired matching transport before any context lookup"
        ),
    },
    {
        "id": "tenant_organization_inactive",
        "phase": "materialized",
        "category": "tenant_availability",
        "rejection_stage": "rpc",
        "description": (
            "Deactivate the measured tenant; this checks tenant availability, "
            "not a cross-tenant identity swap."
        ),
        "mutation_sql": _mutation(
            """
    UPDATE public.organizations
      SET activo = false
      WHERE id = v_run.organization_id AND activo IS TRUE;
"""
        ),
        "expected_sqlstate": "42501",
        "expected_message": "DEMO_ORGANIZATION_INACTIVE",
        "proof_sql": _proof(
            """
      (SELECT count(*) FROM public.organizations o
       WHERE o.id = v_run.organization_id AND o.activo IS FALSE) = 1
      AND to_jsonb(v_policy) IS NOT DISTINCT FROM v_admission.scheduler_snapshot
      AND to_jsonb(v_transport) IS NOT DISTINCT FROM v_admission.transport_snapshot
      AND EXISTS (SELECT 1 FROM demo_flow_writer.lineages l
                  WHERE l.id = v_run.lineage_id
                    AND l.organization_id = v_run.organization_id)
""",
            "tenant_organization_inactive",
        ),
        "source_evidence": (
            "flow/sql/01-private.sql: entry_gate invokes assert_active_organization "
            "before context issuance/reuse; organizations.activo is an existing policy"
        ),
    },
    {
        "id": "manifest_scheduler_hash_drift",
        "phase": "materialized",
        "category": "manifest",
        "rejection_stage": "rpc",
        "description": "Drift the existing scheduler manifest hash, retaining its hex shape.",
        "mutation_sql": _mutation(
            """
    IF v_policy.manifest_sha256 !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_MANIFEST_SHAPE_REQUIRED';
    END IF;
    UPDATE demo_flow_writer.scheduler_approvals
      SET manifest_sha256 = translate(manifest_sha256,
          '0123456789abcdef', '123456789abcdef0')
      WHERE id = v_policy.id
        AND manifest_sha256 = v_policy.manifest_sha256;
"""
        ),
        "expected_sqlstate": "42501",
        "expected_message": "DEMO_SCHEDULER_APPROVAL_INVALID",
        "proof_sql": _proof(
            """
      v_policy.manifest_sha256 ~ '^[0-9a-f]{64}$'
      AND v_policy.manifest_sha256 IS DISTINCT FROM demo_flow_writer.manifest_sha256()
      AND v_policy.manifest_sha256 IS DISTINCT FROM
          v_admission.scheduler_snapshot ->> 'manifest_sha256'
      AND v_policy.manifest_sha256 = translate(
          v_admission.scheduler_snapshot ->> 'manifest_sha256',
          '0123456789abcdef', '123456789abcdef0')
      AND (to_jsonb(v_policy) - 'manifest_sha256') IS NOT DISTINCT FROM
          (v_admission.scheduler_snapshot - 'manifest_sha256')
      AND to_jsonb(v_transport) IS NOT DISTINCT FROM v_admission.transport_snapshot
""",
            "manifest_scheduler_hash_drift",
        ),
        "source_evidence": (
            "flow/issuer/16-owner-registry.sql: validated_scheduler compares the "
            "mutable scheduler manifest to manifest_sha256 before admission reuse"
        ),
    },
    {
        "id": "expiry_run_shortened",
        "phase": "materialized",
        "category": "expiry",
        "rejection_stage": "rpc",
        "description": "Legally shorten the existing run to a measured, already elapsed expiry.",
        "mutation_sql": _mutation(
            """
    v_expiry := v_run.not_before + interval '1 microsecond';
    IF NOT (v_expiry > v_run.not_before
            AND v_expiry < v_run.expires_at
            AND v_expiry < v_run.issued_expires_at
            AND v_expiry < clock_timestamp()) THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_ELAPSED_SHORTENING_REQUIRED';
    END IF;
    UPDATE demo_flow_writer.runs
      SET expires_at = v_expiry
      WHERE id = v_run.id AND expires_at = v_run.expires_at;
"""
        ),
        "expected_sqlstate": "42501",
        "expected_message": "DEMO_RUN_UNAUTHORIZED",
        "proof_sql": _proof(
            """
      v_run.expires_at = v_run.not_before + interval '1 microsecond'
      AND v_run.expires_at > v_run.not_before
      AND v_run.expires_at < v_run.issued_expires_at
      AND v_run.expires_at < clock_timestamp()
      AND v_run.issued_expires_at = v_admission.expires_at
      AND v_admission.expires_at > clock_timestamp()
      AND v_run.revoked_at IS NULL
      AND to_jsonb(v_policy) IS NOT DISTINCT FROM v_admission.scheduler_snapshot
      AND to_jsonb(v_transport) IS NOT DISTINCT FROM v_admission.transport_snapshot
""",
            "expiry_run_shortened",
        ),
        "source_evidence": (
            "flow/sql/01-private.sql: protect_run permits expiry shortening; authorize "
            "raises DEMO_RUN_UNAUTHORIZED at its initial expiry check"
        ),
    },
    {
        "id": "guarded_tenant_run_rebinding",
        "phase": "materialized",
        "category": "tenant_guard_boundary",
        "rejection_stage": "mutation",
        "description": (
            "Attempt rebinding to the existing second sentinel tenant; expect the "
            "run provenance trigger before the row CHECK. No retry RPC is called."
        ),
        "mutation_sql": _mutation(
            """
    IF (SELECT count(DISTINCT s.organization_id)
        FROM pg_temp.financial_manual_sentinels s
        WHERE s.organization_id <> v_run.organization_id) <> 1 THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_SECOND_TENANT_REQUIRED';
    END IF;
    SELECT DISTINCT s.organization_id INTO STRICT v_other_tenant
      FROM pg_temp.financial_manual_sentinels s
      WHERE s.organization_id <> v_run.organization_id;
    IF NOT EXISTS (SELECT 1 FROM public.organizations o
                   WHERE o.id = v_other_tenant) THEN
      RAISE EXCEPTION 'RETRY_NEGATIVE_AUTHORITY_EXISTING_SECOND_TENANT_REQUIRED';
    END IF;
    UPDATE demo_flow_writer.runs
      SET organization_id = v_other_tenant
      WHERE id = v_run.id AND organization_id = v_run.organization_id;
"""
        ),
        "expected_sqlstate": "42501",
        "expected_message": "DEMO_IMMUTABLE_RUN",
        "proof_sql": _proof(
            """
      v_run.expires_at = v_run.issued_expires_at
      AND EXISTS (
        SELECT 1 FROM demo_flow_writer.authorization_receipts a
        JOIN demo_flow_writer.lineages l ON l.id = a.lineage_id
        WHERE a.context_id = v_context AND a.run_id = v_run.id
          AND a.organization_id = v_run.organization_id
          AND l.organization_id = v_run.organization_id
          AND a.manifest_sha256 = v_run.manifest_sha256
          AND a.lineage_sha256 = v_run.lineage_sha256
          AND a.not_before = v_run.not_before
          AND a.expires_at = v_run.issued_expires_at
      )
      AND to_jsonb(v_policy) IS NOT DISTINCT FROM v_admission.scheduler_snapshot
      AND to_jsonb(v_transport) IS NOT DISTINCT FROM v_admission.transport_snapshot
""",
            "guarded_tenant_run_rebinding",
        ),
        "source_evidence": (
            "flow/sql/01-private.sql: protect_run BEFORE UPDATE trigger rejects "
            "organization_id changes as DEMO_IMMUTABLE_RUN; this is guard coverage only"
        ),
    },
)


BLOCKED_CASES = (
    {
        "id": "tenant_identity_drift",
        "phase": "materialized",
        "category": "tenant_identity",
        "status": "BLOCKED",
        "reason": (
            "A changed tenant cannot safely reach the retry verifier in this source. "
            "Existing scheduler/transport/run/lineage organization_id CHECKs pin the "
            "tenant, and server admissions, authorizations, and lineages reject "
            "updates. Changing JWT claims does not change attested tenant identity. "
            "Tenant deactivation and the run-rebinding guard have separate, accurately "
            "scoped cases; neither is evidence of a cross-tenant retry rejection."
        ),
        "source_evidence": (
            "flow/issuer/16-owner-registry.sql: tenant CHECKs and immutable_admissions; "
            "flow/issuer/10-issuer.sql: immutable_authorizations; "
            "flow/sql/01-private.sql: immutable_lineages and protect_run"
        ),
    },
)
