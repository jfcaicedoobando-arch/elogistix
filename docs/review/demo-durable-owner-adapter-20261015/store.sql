-- REVIEW ONLY. Never executed. No GRANT, role, credentials, endpoint or existing DB references.
-- Applying requires an independently authorized disposable database. Not an operational migration.
CREATE SCHEMA demo_owner_review;
CREATE TABLE demo_owner_review.issuer_obligations (
 deployment text NOT NULL CHECK(deployment<>''),
 obligation_id uuid NOT NULL,
 canonical_version integer NOT NULL CHECK(canonical_version=1),
 tenant_id text NOT NULL CHECK(tenant_id<>''),
 manifest_identity text NOT NULL CHECK(manifest_identity<>''),
 scheduler_job_identity text NOT NULL CHECK(scheduler_job_identity<>''),
 authorized_occurrence text NOT NULL CHECK(authorized_occurrence<>''),
 context_id uuid NOT NULL,
 binding jsonb NOT NULL CHECK(jsonb_typeof(binding)='object'),
 PRIMARY KEY(deployment,obligation_id),
 UNIQUE(deployment,context_id),
 UNIQUE(deployment,tenant_id,manifest_identity,scheduler_job_identity,authorized_occurrence),
 UNIQUE(deployment,obligation_id,context_id,binding)
);
-- Canonical components MUST come from protected issuer/scheduler evidence, never request fields.
-- manifest_identity denotes semantic obligation family; changing artifact version/snapshot is
-- binding/revocation, never a new obligation. Epoch requires separately authorized new occurrence.
-- Issuer integration is deliberately absent. INSERT access must not belong to an ingress/client.
CREATE TABLE demo_owner_review.claims (
 deployment text NOT NULL,
 obligation_id uuid NOT NULL,
 context_id uuid NOT NULL,
 stage text NOT NULL CHECK(stage IN ('dispatch','ingress')),
 binding jsonb NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(deployment,obligation_id,stage),
 UNIQUE(deployment,context_id,stage),
 FOREIGN KEY(deployment,obligation_id,context_id,binding)
 REFERENCES demo_owner_review.issuer_obligations(deployment,obligation_id,context_id,binding)
);
CREATE FUNCTION demo_owner_review.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'immutable owner history'; END $$;
CREATE TRIGGER immutable_issuance BEFORE UPDATE OR DELETE OR TRUNCATE
 ON demo_owner_review.issuer_obligations FOR EACH STATEMENT
 EXECUTE FUNCTION demo_owner_review.reject_mutation();
CREATE TRIGGER immutable_claims BEFORE UPDATE OR DELETE OR TRUNCATE
 ON demo_owner_review.claims FOR EACH STATEMENT
 EXECUTE FUNCTION demo_owner_review.reject_mutation();
-- Not a security boundary against superusers/DDL owners/restore. Explicit runtime ACL and
-- restoration fencing review required; no grants or role changes are proposed here.
