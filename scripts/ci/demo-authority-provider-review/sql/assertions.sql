\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.expect_reject(command text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE message text; failed boolean:=false; BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
  IF strpos(message,expected)=0 THEN RAISE EXCEPTION 'Wrong denial for %: %',expected,message; END IF;
  failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Expected denial: %',expected; END IF;
END $$;
-- Actual reader result, not a JS or SQL authority double.
DO $$ DECLARE oldc demo_flow_writer.server_admissions; c uuid; data jsonb; BEGIN
 SELECT a.* INTO STRICT oldc FROM demo_flow_writer.server_admissions a JOIN public.authority_test_result t USING(context_id);
 SELECT demo_flow_writer.issue_bound_context(authority_id) INTO c FROM public.authority_test_result;
 IF c<>oldc.context_id OR (SELECT count(*) FROM demo_flow_writer.server_admissions)<>1
  OR (SELECT expires_at FROM demo_flow_writer.server_admissions WHERE context_id=c)<>oldc.expires_at THEN
  RAISE EXCEPTION 'Binding retry minted or extended context'; END IF;
 data:=demo_flow_writer.read_authority(c);
 IF data#>>'{protectedAuthority,authorizedOccurrence}'<>'EXPLICIT_FIXTURE_OCCURRENCE'
  OR data#>>'{protectedAuthority,manifestIdentity}'<>'SYNTHETIC_SEMANTIC_FAMILY'
  OR data#>>'{protectedAuthority,skipMs}'<>'0' THEN RAISE EXCEPTION 'Reader did not derive protected values'; END IF;
END $$;
SELECT pg_temp.expect_reject(format('INSERT INTO demo_flow_writer.protected_occurrences SELECT gen_random_uuid(),deployment,organization_id,manifest_identity,scheduler_approval_id,scheduler_job,authorized_occurrence,preparation_admission_id,receipt_id,skip_ms,generation+1,restore_fence,not_before,expires_at+interval ''1 minute'',approved_by_owner,approval_reference FROM demo_flow_writer.protected_occurrences WHERE id=%L',authority_id),'duplicate key') FROM public.authority_test_result;
SELECT pg_temp.expect_reject(format('UPDATE demo_flow_writer.protected_occurrences SET skip_ms=1 WHERE id=%L',authority_id),'DEMO_IMMUTABLE_PROVENANCE') FROM public.authority_test_result;
SELECT pg_temp.expect_reject('TRUNCATE demo_flow_writer.occurrence_context_bindings','DEMO_IMMUTABLE_PROVENANCE');
SELECT pg_temp.expect_reject(format('DELETE FROM demo_flow_writer.occurrence_context_bindings WHERE context_id=%L',context_id),'DEMO_IMMUTABLE_PROVENANCE') FROM public.authority_test_result;
SELECT pg_temp.expect_reject('SELECT demo_flow_writer.authority_instant(''2030-01-01T00:00:00.000001Z'')','DEMO_AUTHORITY_TIMESTAMP_PRECISION');
SELECT pg_temp.expect_reject('SELECT demo_flow_writer.authority_instant(''infinity'')','DEMO_AUTHORITY_TIMESTAMP_PRECISION');
-- Every mutation below and its expected failure share one exception subtransaction.
CREATE FUNCTION pg_temp.mutate_read(mutation text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c uuid; message text; failed boolean:=false; BEGIN
 SELECT context_id INTO c FROM public.authority_test_result;
 BEGIN EXECUTE mutation; PERFORM demo_flow_writer.read_authority(c);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
  IF strpos(message,expected)=0 THEN RAISE EXCEPTION 'Wrong mutation denial for %: %',expected,message; END IF;
  failed:=true;
 END;
 IF NOT failed THEN RAISE EXCEPTION 'Expected mutation denial: %',expected; END IF;
END $$;
SELECT pg_temp.mutate_read('UPDATE demo_flow_writer.authority_fences SET stopped=true','DEMO_AUTHORITY_FENCE_HOLD');
SELECT pg_temp.mutate_read('UPDATE demo_flow_writer.authority_fences SET generation=2','DEMO_AUTHORITY_FENCE_HOLD');
SELECT pg_temp.mutate_read('UPDATE demo_flow_writer.authority_fences SET fence=''WRONG''','DEMO_AUTHORITY_FENCE_HOLD');
SELECT pg_temp.mutate_read('UPDATE demo_flow_writer.scheduler_approvals SET disabled_at=clock_timestamp()','DEMO_SCHEDULER_APPROVAL_INVALID');
SELECT pg_temp.mutate_read('UPDATE demo_flow_writer.transport_approvals SET disabled_at=clock_timestamp()','DEMO_SCHEDULER_APPROVAL_INVALID');
SELECT pg_temp.mutate_read('UPDATE public.organizations SET activo=false','DEMO_ORGANIZATION_INACTIVE');
SELECT pg_temp.mutate_read('UPDATE public.proveedores SET nombre=''DRIFT''','DEMO_ADMITTED_SUPPLIER_DRIFT');
SELECT pg_temp.mutate_read('DELETE FROM public.user_roles','DEMO_SPONSOR_ROLE_REQUIRED');
SELECT pg_temp.mutate_read('UPDATE auth.users SET deleted_at=clock_timestamp()','DEMO_SPONSOR_ACCOUNT_DISABLED_OR_SCHEMA_UNKNOWN');
SELECT pg_temp.mutate_read(format('SELECT demo_flow_writer.revoke_occurrence(%L,''test revocation'')',authority_id),'DEMO_AUTHORITY_REVOKED') FROM public.authority_test_result;
-- Revocation is append-only, including direct INSERTs serialized by the trigger.
BEGIN;
SELECT demo_flow_writer.revoke_occurrence(authority_id,'FIXTURE ONLY') FROM public.authority_test_result;
SELECT pg_temp.expect_reject('DELETE FROM demo_flow_writer.occurrence_revocations','DEMO_IMMUTABLE_PROVENANCE');
SELECT pg_temp.expect_reject('UPDATE demo_flow_writer.occurrence_revocations SET reason=''new''','DEMO_IMMUTABLE_PROVENANCE');
ROLLBACK;
-- Whole-database restore safety is NOT established by restoring this same fence.
-- Demonstrate the proposed stopped default and absent configured deployment.
INSERT INTO demo_flow_writer.authority_fences VALUES('STOPPED_FIXTURE',1,'STOPPED_FENCE',DEFAULT,current_user::regrole::oid,'FIXTURE ONLY');
SELECT pg_temp.expect_reject(format('SELECT demo_flow_writer.register_occurrence(''STOPPED_FIXTURE'',''FAMILY'',''OCCURRENCE'',''70000000-0000-4000-8000-000000000001'',%L,0,clock_timestamp(),clock_timestamp()+interval ''1 minute'',''test'')',receipt_id),'DEMO_AUTHORITY_FENCE_HOLD') FROM public.authority_test_receipt;
-- Cross-reference and unsafe scalar insertions must roll back completely.
SELECT pg_temp.expect_reject(format('SELECT demo_flow_writer.register_occurrence(''SYNTHETIC_AUTHORITY_REVIEW'',''FAMILY'',''BAD_SKIP'',''70000000-0000-4000-8000-000000000001'',%L,9007199254740992,clock_timestamp(),clock_timestamp()+interval ''1 minute'',''test'')',receipt_id),'check constraint') FROM public.authority_test_receipt;
SELECT pg_temp.expect_reject(format('SELECT demo_flow_writer.register_occurrence(''SYNTHETIC_AUTHORITY_REVIEW'',''FAMILY'',''BAD_TIME'',''70000000-0000-4000-8000-000000000001'',%L,0,date_trunc(''milliseconds'',clock_timestamp())-interval ''1 second''+interval ''1 microsecond'',date_trunc(''milliseconds'',clock_timestamp())+interval ''1 minute'',''test'')',receipt_id),'DEMO_AUTHORITY_TIMESTAMP_PRECISION') FROM public.authority_test_receipt;
SELECT pg_temp.expect_reject('SELECT demo_flow_writer.read_authority(''ffffffff-ffff-4fff-8fff-ffffffffffff'')','query returned no rows');
DO $$ BEGIN IF (SELECT count(*) FROM demo_flow_writer.protected_occurrences)<>1 OR (SELECT count(*) FROM demo_flow_writer.occurrence_context_bindings)<>1 OR EXISTS(SELECT 1 FROM demo_flow_writer.occurrence_revocations) THEN RAISE EXCEPTION 'Failed statements leaked rows'; END IF; END $$;
-- A new occurrence cannot reuse another occurrence's context.
BEGIN;
CREATE TEMP TABLE second_authority AS SELECT demo_flow_writer.register_occurrence(
 'SYNTHETIC_AUTHORITY_REVIEW','SYNTHETIC_SEMANTIC_FAMILY','SECOND_FIXTURE_OCCURRENCE',
 '70000000-0000-4000-8000-000000000001',receipt_id,0,
 date_trunc('milliseconds',clock_timestamp())-interval '1 minute',
 date_trunc('milliseconds',clock_timestamp())+interval '10 minutes','FIXTURE ONLY') authority_id
 FROM public.authority_test_receipt;
SELECT pg_temp.expect_reject(format('INSERT INTO demo_flow_writer.occurrence_context_bindings VALUES(%L,%L,current_user::regrole::oid)',s.authority_id,t.context_id),'duplicate key')
 FROM second_authority s CROSS JOIN public.authority_test_result t;
-- A genuinely issued legacy SQL16 context is not silently normalized to ms.
-- Repeated clock samples only find an inexact native timestamp; no stored row is altered.
CREATE TEMP TABLE legacy_context(context_id uuid);
DO $$ DECLARE c demo_flow_writer.server_admissions; ctx uuid; attempt integer; BEGIN
 FOR attempt IN 1..10 LOOP
  SELECT demo_flow_writer.issue_scheduler_context(
   '30000000-0000-4000-8000-000000000001',receipt_id,300) INTO ctx FROM public.authority_test_receipt;
  SELECT * INTO STRICT c FROM demo_flow_writer.server_admissions WHERE context_id=ctx;
  IF c.issued_at<>date_trunc('milliseconds',c.issued_at) OR c.not_before<>date_trunc('milliseconds',c.not_before) OR c.expires_at<>date_trunc('milliseconds',c.expires_at) THEN
   INSERT INTO legacy_context VALUES(ctx); RETURN;
  END IF;
 END LOOP;
 RAISE EXCEPTION 'Legacy samples unexpectedly exactly ms; no precision evidence';
END $$;
INSERT INTO demo_flow_writer.occurrence_context_bindings SELECT s.authority_id,c.context_id,current_user::regrole::oid FROM second_authority s CROSS JOIN legacy_context c;
SELECT pg_temp.expect_reject(format('SELECT demo_flow_writer.read_authority(%L)',context_id),'DEMO_AUTHORITY_TIMESTAMP_PRECISION') FROM legacy_context;
ROLLBACK;
-- Authority expiry is strict; an expired authority cannot mint another context.
BEGIN;
CREATE TEMP TABLE expiring_authority AS SELECT demo_flow_writer.register_occurrence(
 'SYNTHETIC_AUTHORITY_REVIEW','SYNTHETIC_SEMANTIC_FAMILY','EXPIRING_FIXTURE_OCCURRENCE',
 '70000000-0000-4000-8000-000000000001',receipt_id,0,
 date_trunc('milliseconds',clock_timestamp())-interval '1 minute',
 date_trunc('milliseconds',clock_timestamp())+interval '2 seconds','FIXTURE ONLY') authority_id
 FROM public.authority_test_receipt;
SELECT demo_flow_writer.issue_bound_context(authority_id) FROM expiring_authority;
SELECT pg_sleep(2.1);
SELECT pg_temp.expect_reject(format('SELECT demo_flow_writer.issue_bound_context(%L)',authority_id),'DEMO_AUTHORITY_EXPIRED_OR_EARLY') FROM expiring_authority;
ROLLBACK;
-- A separate short context expires while its authority and all approvals remain
-- valid. This is an explicit owner-created consumer fixture, not a claim that the
-- new issuer accepts custom TTLs. No existing immutable admission is altered.
BEGIN;
CREATE TEMP TABLE live_authority AS SELECT demo_flow_writer.register_occurrence(
 'SYNTHETIC_AUTHORITY_REVIEW','SYNTHETIC_SEMANTIC_FAMILY','SHORT_CONTEXT_FIXTURE_OCCURRENCE',
 '70000000-0000-4000-8000-000000000001',receipt_id,0,
 date_trunc('milliseconds',clock_timestamp())-interval '1 minute',
 date_trunc('milliseconds',clock_timestamp())+interval '10 minutes','FIXTURE ONLY') authority_id
 FROM public.authority_test_receipt;
CREATE TEMP TABLE short_context AS
WITH inserted AS (
 INSERT INTO demo_flow_writer.server_admissions(scheduler_approval_id,transport_id,scheduler_snapshot,transport_snapshot,
 identity_receipt_id,identity_version,identity_sha256,issued_by_owner,issued_at,not_before,expires_at)
 SELECT c.scheduler_approval_id,c.transport_id,c.scheduler_snapshot,c.transport_snapshot,
 c.identity_receipt_id,c.identity_version,c.identity_sha256,current_user::regrole::oid,t.tick,t.tick,t.tick+interval '2 seconds'
 FROM demo_flow_writer.server_admissions c JOIN public.authority_test_result r USING(context_id)
 CROSS JOIN (SELECT date_trunc('milliseconds',clock_timestamp()) tick) t
 RETURNING context_id,expires_at
) SELECT * FROM inserted;
INSERT INTO demo_flow_writer.occurrence_context_bindings
 SELECT a.authority_id,c.context_id,current_user::regrole::oid FROM live_authority a CROSS JOIN short_context c;
DO $$ BEGIN PERFORM demo_flow_writer.read_authority(context_id) FROM short_context; END $$;
CREATE TEMP TABLE context_count AS SELECT count(*) n FROM demo_flow_writer.server_admissions;
SELECT pg_sleep(2.1);
DO $$ BEGIN PERFORM demo_flow_writer.checked_occurrence(authority_id) FROM live_authority; END $$;
SELECT pg_temp.expect_reject(format('SELECT demo_flow_writer.read_authority(%L)',context_id),'DEMO_BOUND_CONTEXT_CONFLICT_OR_EXPIRED') FROM short_context;
SELECT pg_temp.expect_reject(format('SELECT demo_flow_writer.issue_bound_context(%L)',authority_id),'DEMO_BOUND_CONTEXT_CONFLICT_OR_EXPIRED') FROM live_authority;
DO $$ BEGIN
 IF (SELECT count(*) FROM demo_flow_writer.server_admissions)<>(SELECT n FROM context_count)
  OR EXISTS(SELECT 1 FROM short_context c JOIN demo_flow_writer.server_admissions a USING(context_id) WHERE a.expires_at<>c.expires_at)
  OR (SELECT b.context_id FROM demo_flow_writer.occurrence_context_bindings b JOIN live_authority a USING(authority_id))<>(SELECT context_id FROM short_context) THEN
  RAISE EXCEPTION 'Expired context was replaced or extended'; END IF;
END $$;
ROLLBACK;
SELECT 'AUTHORITY_NATIVE_ASSERTIONS_COMPLETE';
