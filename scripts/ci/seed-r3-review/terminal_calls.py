"""Pending integration: direct terminal-only calls in the owned synthetic lab.

No historical seed is called. Requires hash-gated concurrency_cases controls
and Runner APIs; invoke run_terminal_calls(runner, controls) after the matrix.
Only the caller may integrate/hash-gate this module. No Docker/SQL on import.
The synthetic auth.uid helper is changed only AFTER terminal hashes pass; its
full catalog row is separately snapshotted because snapshot.sql omits auth.
"""
import hashlib
import json
import re

R3_SHA256 = '7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86'
STOPPED = {
    '_seed_demo_limpiar_financiero()': 'e64b1166ddfda818de43dd74cc19e7ab3afe3009e5099eb86301cb2fc9c5926e',
    'seed_demo_organization_core()': '2a10ee2adc61ec165240c49023eae6e851006da93ab1194396ba6e4649256da2',
    'seed_demo_organization()': 'f13fadcb38f78b0c2a48b25e2905701fa8d74be18751aece5b082eb88c85f02c',
    'seed_demo_organization_guarded(bigint)': '6fb31a558e69b76e4673ca0b040a330e1f8c5c3045c8fec6ca6465f633f2b62e',
}
CALLS = (
    ('cleanup', 'SELECT public._seed_demo_limpiar_financiero();'),
    ('core', 'SELECT public.seed_demo_organization_core();'),
    ('legacy', 'SELECT public.seed_demo_organization();'),
    ('guarded_zero', 'SELECT public.seed_demo_organization_guarded(0);'),
    ('guarded_cooldown', 'SELECT public.seed_demo_organization_guarded(600000);'),
)
MESSAGE = 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'
TABLES = ['public.demo_seed_state', 'qa_fixture.control', 'qa_owned.bridge_target', 'supabase_migrations.schema_migrations']
INVENTORY_SQL = """SELECT jsonb_build_object('relations',coalesce(jsonb_agg(n.nspname||'.'||c.relname ORDER BY n.nspname,c.relname),'[]')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','f','m') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema';"""
AUTH_SNAPSHOT_SQL = """SELECT jsonb_build_object('row',to_jsonb(p),'xmin',p.xmin::text,'ctid',p.ctid::text) FROM pg_proc p WHERE p.oid='auth.uid()'::regprocedure;"""
AUTH_FIXTURE_SQL = """CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;"""


def require(value, message):
    if not value:
        raise AssertionError(message)


def require_terminal(controls, snapshot):
    require(controls.body_hashes(snapshot) == STOPPED, 'Four exact terminal hashes required BEFORE every direct call')


def stopped_call(controls, session, snapshot, name):
    require_terminal(controls, snapshot)
    statements = dict(CALLS)
    require(name in statements, 'Unknown terminal call')
    reply = session.execute(statements[name])
    require(reply.state == '55000' and controls.primary_errors(reply.text) == [('55000', MESSAGE)], 'Unexpected terminal outcome: ' + reply.text)
    return reply


def observe_holder(controls, observer, holder):
    controls.validate_identity(holder)
    # int8 advisory key is the signed hashtext result promoted to bigint.
    sql = """SELECT jsonb_build_object('pid',a.pid,'backend_start',a.backend_start::text,'held',EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.locktype='advisory' AND l.granted AND l.mode='ExclusiveLock' AND l.classid::bigint=((hashtext('seed_demo_organization')::bigint >> 32) & 4294967295) AND l.objid::bigint=(hashtext('seed_demo_organization')::bigint & 4294967295) AND l.objsubid=1)) FROM pg_stat_activity a WHERE a.pid=""" + str(holder['pid']) + ';'
    row = observer.execute('SELECT pg_stat_clear_snapshot(); ' + sql).json()
    require(row == {'pid': holder['pid'], 'backend_start': holder['backend_start'], 'held': True}, 'Historical advisory lock holder not observed')
    # Autocommit xact try-lock never waits. An unexpected acquisition fails this
    # test and is released by that statement transaction, without touching seeds.
    attempt = observer.execute("SELECT jsonb_build_object('acquired',pg_try_advisory_xact_lock(hashtext('seed_demo_organization')));").json()
    require(attempt == {'acquired': False}, 'Other backend must retain seed advisory lock')
    return row


def run_terminal_calls(runner, controls):
    source = (controls.ROOT / 'PROPOSAL_R3_rename_lock_admission.sql').read_bytes()
    require(hashlib.sha256(source).hexdigest() == R3_SHA256, 'R3 bytes changed')
    r3 = source.decode('utf-8')
    historical = json.loads(re.search(r'\$atomic_historical_hashes\$(.*?)\$atomic_historical_hashes\$', r3, re.S).group(1))
    runner.result['terminal_direct_calls'] = 'RUNNING'
    runner.save()
    evidence = []
    with controls.case_sessions(runner, 'terminal_calls') as (db, a, b):
        require(a.identity['pid'] != b.identity['pid'], 'Independent holder and caller required')
        inventory = b.execute(INVENTORY_SQL).json()
        require(inventory == {'relations': TABLES}, 'Non-synthetic table inventory rejected')
        before = runner.snapshot(db, 'terminal-historical-definition-baseline')
        require(controls.body_hashes(before) == historical, 'Independent historical-definition baseline required')
        # Only advisory-lock machinery is invoked here, never a historical seed.
        a.execute("BEGIN; SELECT pg_advisory_xact_lock(hashtext('seed_demo_organization'));").ok()
        observe_holder(controls, b, a.identity)
        # Single DO statement runs in autocommit: its success marker is after
        # statement transaction completion. A retains its separate transaction.
        b.execute(r3).ok()
        terminal = runner.snapshot(db, 'terminal-after-r3-commit')
        require_terminal(controls, terminal)
        controls.verify_transition(before, terminal, STOPPED)
        # Local fake identity removes core's earlier 42501 branch; this is a
        # fixture helper, not an account or real user. R3 bytes stay unchanged.
        b.execute(AUTH_FIXTURE_SQL).ok()
        b.execute("SET request.jwt.claims='{\"role\":\"service_role\"}'; SET statement_timeout='2s'; SET lock_timeout='500ms';").ok()
        identity = b.execute("SELECT jsonb_build_object('uid',auth.uid()::text,'role',current_setting('request.jwt.claims')::jsonb->>'role');").json()
        require(identity == {'uid': '00000000-0000-0000-0000-000000000001', 'role': 'service_role'}, 'Synthetic caller fixture mismatch')
        baseline = runner.snapshot(db, 'terminal-call-baseline')
        require(baseline == terminal, 'Fixture setup changed tracked objects')
        auth_baseline = b.execute(AUTH_SNAPSHOT_SQL).json()
        for name, _ in CALLS:
            current = runner.snapshot(db, 'terminal-before-' + name)
            require(current == baseline, 'Tracked state changed before call')
            require_terminal(controls, current)
            lock_before = observe_holder(controls, b, a.identity)
            reply = stopped_call(controls, b, current, name)
            lock_after = observe_holder(controls, b, a.identity)
            require(runner.snapshot(db, 'terminal-after-' + name) == baseline, 'Terminal call changed complete snapshot')
            require(b.execute(AUTH_SNAPSHOT_SQL).json() == auth_baseline, 'Auth helper changed during call')
            require(b.execute(INVENTORY_SQL).json() == inventory, 'Table inventory changed during call')
            evidence.append({'call': name, 'sqlstate': reply.state, 'primary_error': MESSAGE, 'lock_before': lock_before, 'lock_after': lock_after})
        a.execute('ROLLBACK;').ok()
    # PASS/check occur only after both sessions and synthetic DB are cleaned.
    runner.check('terminal_direct_calls_while_seed_advisory_held', routes=4, invocations=5, historical_seed_invocations=0, evidence=evidence, auth_fixture='synthetic_nonnull_uuid_after_verified_R3')
    runner.result['terminal_direct_calls'] = 'PASS'
    runner.save()
