"""Owned PG17.6 evidence only. Does not accept a DSN or operational target."""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
import time

from cases import database
from committed_cases import capture, compare, rejected, Session, SessionCapture
from committed_state import compare_committed_state
from event_cases import _fixture, _state, _trace, require, REPOSITORY
from public_source import verify_source
from transaction_cases import _unchanged
from timeout_profile import (CandidateWindow, render_timeout_proposal,
    render_TEST_ONLY_timeout, timeout_core_sha256)

CASES = (
    'timeout-public-first-action-fence',
    'timeout-exact-canonical-commit-120-prearmed',
    'timeout-postcommit-profile-restored',
    'timeout-registered-replay-no-allocation',
    'timeout-stale-duplicate-no-second-effect',
    'timeout-zero-entry-rejected',
    'timeout-twenty-entry-rejected',
    'timeout-lock-three-entry-rejected',
    'timeout-window-not-yet-valid-rejected',
    'timeout-window-expired-before-locks-rejected',
    'timeout-implicit-pg-proc-lock-three-seconds',
    'timeout-effective-deadline-120-not-visible-twenty',
    'timeout-rollback-after-insert-sequence-gap',
    'timeout-lost-response-committed-comparison',
    'timeout-open-writer-rejected-postcommit-accepted',
    'timeout-concurrent-duplicate-nowait',
    'timeout-lost-response-still-open-not-established',
    'timeout-expiration-during-program-before-effects',
    'timeout-rollback-gap-retry-blocked',
)

class Lane:
    def __init__(self,r):
        self.output=r.output/'timeout-evidence';self.output.mkdir()
        self.query=r.query


def window(*, start=-5, end=480):
    now=datetime.now(timezone.utc)
    def stamp(value):
        return value.isoformat(timespec='microseconds').replace('+00:00','Z')
    return CandidateWindow(stamp(now+timedelta(seconds=start)),stamp(now+timedelta(seconds=end)))


def save(lane,label,value):
    (lane.output/(label+'.json')).write_text(json.dumps(value,indent=2)+'\n')


def compile_sql(candidate,pair,validator,lane,label,*,validity=None,fault=None):
    validity=validity or window()
    common=dict(validate_projection=validator,semantic_witness=pair[1],window=validity)
    public=render_timeout_proposal(candidate,pair[0],**common)
    normal=render_TEST_ONLY_timeout(candidate,pair[0],scope='synthetic-ci',**common)
    digest=timeout_core_sha256(candidate,pair[0],**common)
    def extract(sql):
        core=re.findall(r'-- CRM_TIMEOUT_CORE_BEGIN\n([\s\S]*?)-- CRM_TIMEOUT_CORE_END',sql)
        require(len(core)==1,'Program marker count')
        return core[0]
    require(extract(public)==extract(normal),'Public/test normal cores differ')
    require(hashlib.sha256(extract(normal).encode()).hexdigest()==digest,'Independent hash differs')
    actual=normal
    if fault:
        actual=render_TEST_ONLY_timeout(candidate,pair[0],scope='synthetic-ci',fault=fault,**common)
        injection={'after_insert':"RAISE EXCEPTION 'CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT';",
                   'deadline_after_payload':'PERFORM pg_catalog.pg_sleep(125);',
                   'expire_before_payload':'PERFORM pg_catalog.pg_sleep(4);'}[fault]
        require(extract(actual).count(injection)==1 and extract(actual).replace(injection,'',1)==extract(normal),
                'Fault differs beyond one fixed TEST_ONLY injection')
    (lane.output/(label+'-public-fenced.sql')).write_text(public)
    save(lane,label+'-program-proof',dict(core_sha256=digest,public_and_test_core_equal=True,
        window=vars(validity),profile='CRM_120S_LOCAL_LOCK_3S_V1',fault=fault,
        actual_core_sha256=hashlib.sha256(extract(actual).encode()).hexdigest(),
        canonical_sha256=hashlib.sha256(candidate).hexdigest(),endpoint_admission='NOT_ADMITTED'))
    return actual,public


def setup(r,db,label,body):
    _fixture(r,db,label,body)
    r.query('ALTER DATABASE '+db+" SET statement_timeout='120s';",label+'-entry-timeout',user='supabase_admin')


def record(r,name,**details):
    r.check(name,endpoint_admission='NOT_ADMITTED',**details)


def profile(r,db,label):
    return json.loads(r.query("SELECT pg_catalog.jsonb_build_object('statement',current_setting('statement_timeout'),"
        "'lock',current_setting('lock_timeout'));",label,db).stdout)


def summary(lane,label,before,after,validator):
    result=compare(before,after,validator)
    require(result['admission']=='NOT_ADMITTED' and result['retry_permission']=='NOT_GRANTED', 'Unsafe comparison')
    save(lane,label+'-summary',result)


def no_effects(r,db,label,before,state,trace,lane,validator):
    after=capture(lane,validator,db,label+'-after')
    _unchanged(before[0],after[0])
    require(_state(r,db,label+'-state-after')==state and _trace(r,db,label+'-trace-after')==trace,
            'Rejected experiment changed state')
    return after


def run_timeout_cases(r,validator):
    lane=Lane(r)
    body=verify_source()['body']
    candidate=(REPOSITORY/'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()
    with database(r,'timeout_commit') as db:
        setup(r,db,'timeout-commit',body)
        before=capture(lane,validator,db,'commit-before')
        state=_state(r,db,'commit-state-before');trace=_trace(r,db,'commit-trace-before')
        sql,public=compile_sql(candidate,before,validator,lane,'commit')
        response=r.query(public,'public-fenced',db,expected=3)
        require('CRM_TIMEOUT_NOT_ADMITTED' in response.stdout,'Missing public fence')
        no_effects(r,db,'fenced',before,state,trace,lane,validator)
        record(r,CASES[0],unconditional_first_executable_action=True)
        with Session(r,db,'timeout_reuse',lane) as session:
            response=session.execute(sql,'execute-normal')
            require('TEST_ONLY_TIMEOUT_STAGE:preimage:2min/3s' in response and
                    'TEST_ONLY_TIMEOUT_STAGE:payload:20s/3s' in response,'Missing measured stages')
            observed=json.loads(session.execute("SELECT pg_catalog.jsonb_build_object('statement',current_setting('statement_timeout'),'lock',current_setting('lock_timeout'));",'postflight'))
            require(observed=={'statement':'2min','lock':'0'},'Same session not restored after implicit commit')
            save(lane,'same-session-postflight-profile',observed)
        after=capture(lane,validator,db,'commit-after')
        summary(lane,'commit',before,after,validator)
        record(r,CASES[1],unchanged_canonical_bytes=True,preimage='2min/3s',payload_visible='20s/3s')
        record(r,CASES[2],same_session_postcommit=observed)
        state=_state(r,db,'committed-state');trace=_trace(r,db,'committed-trace')
        duplicate=r.query(sql,'stale-duplicate',db,expected=3)
        require('CRM_TRANSACTION_PREIMAGE_' in duplicate.stdout,'Unexpected stale failure')
        no_effects(r,db,'duplicate',after,state,trace,lane,validator)
        record(r,CASES[4],original_absent_contract_rejected=True)
        replay,_=compile_sql(candidate,after,validator,lane,'registered')
        response=r.query(replay,'registered-replay',db)
        require('TEST_ONLY_TRANSACTION_REGISTERED_READ_ONLY' in response.stdout
                and 'TEST_ONLY_DEFAULT_INSERT:' not in response.stdout,'Replay did not avoid allocation')
        no_effects(r,db,'replay',after,state,trace,lane,validator)
        record(r,CASES[3],fresh_terminal_preimage=True,no_nextval=True)

    with database(r,'timeout_rejected') as db:
        setup(r,db,'timeout-rejected',body)
        before=capture(lane,validator,db,'reject-before')
        state=_state(r,db,'reject-state');trace=_trace(r,db,'reject-trace')
        sql,_=compile_sql(candidate,before,validator,lane,'reject')
        _,program=sql.split('\n',1)
        for n,prelude in ((5,"SET statement_timeout='0'; SET lock_timeout='0';"),
                          (6,"SET statement_timeout='20s'; SET lock_timeout='0';"),
                          (7,"SET statement_timeout='120s'; SET lock_timeout='3s';")):
            response=r.query(prelude+program,CASES[n],db,expected=3)
            require('CRM_TIMEOUT_ENTRY_PROFILE' in response.stdout,'Bad entry accepted')
            no_effects(r,db,CASES[n],before,state,trace,lane,validator)
            record(r,CASES[n],pre_effect_rejection=True)
        for n,validity in ((8,window(start=60,end=180)),(9,window(start=-120,end=-60))):
            expired,_=compile_sql(candidate,before,validator,lane,CASES[n],validity=validity)
            # A held explicit ledger lock proves expiry precedes even NOWAIT lock acquisition.
            with Session(r,db,'timeout_window_holder_'+str(n),lane) as holder:
                holder.execute('BEGIN; LOCK TABLE drizzle.__drizzle_migrations IN ACCESS EXCLUSIVE MODE;','hold')
                response=r.query(expired,CASES[n],db,expected=3)
                require('CRM_TIMEOUT_CANDIDATE_EXPIRED_OR_NOT_YET_VALID' in response.stdout
                        and '55P03' not in response.stdout,'Window failed after lock acquisition')
                holder.execute('ROLLBACK;','release')
            no_effects(r,db,CASES[n],before,state,trace,lane,validator)
            record(r,CASES[n],immutable_compiled_window=True,before_held_ledger_lock=True)

    with database(r,'timeout_expires_during') as db:
        setup(r,db,'timeout-expires-during',body)
        before=capture(lane,validator,db,'expires-during-before')
        state=_state(r,db,'expires-during-state');trace=_trace(r,db,'expires-during-trace')
        sql,_=compile_sql(candidate,before,validator,lane,'expires-during',
            validity=window(start=-5,end=2),fault='expire_before_payload')
        response=r.query(sql,'expires-during',db,expected=3)
        require('CRM_TIMEOUT_CANDIDATE_EXPIRED_OR_NOT_YET_VALID' in response.stdout
                and 'TEST_ONLY_TIMEOUT_STAGE:preimage:2min/3s' in response.stdout
                and 'TEST_ONLY_TIMEOUT_STAGE:payload' not in response.stdout,
                'Expiration after locks must precede payload and allocation')
        no_effects(r,db,'expires-during',before,state,trace,lane,validator)
        record(r,CASES[17],fixed_test_only_sleep_seconds=4,expired_after_locks_before_effects=True)

    with database(r,'timeout_implicit') as db:
        setup(r,db,'timeout-implicit',body)
        before=capture(lane,validator,db,'implicit-before')
        state=_state(r,db,'implicit-state');trace=_trace(r,db,'implicit-trace')
        sql,_=compile_sql(candidate,before,validator,lane,'implicit')
        with Session(r,db,'timeout_catalog_holder',lane) as holder:
            holder.execute("BEGIN; GRANT EXECUTE ON FUNCTION public._crm_empresa_no_borrar_cliente() TO service_role;",'hold-pg-proc-tuple')
            process=r.session("SET application_name='timeout_catalog_waiter';"+sql,'timeout_catalog_waiter',db)
            started=time.monotonic()
            wait=r.wait_lock('timeout_catalog_waiter',db)
            r.release(process,'\\q')
            response=r.finish_session(process,'implicit-result',expected=3)
            elapsed=time.monotonic()-started
            require('55P03' in response.stdout and 'lock timeout' in response.stdout
                    and 2.5<=elapsed<12,'Expected actual 3s implicit lock timeout')
            require(any(item['wait_event']=='transactionid' for item in wait),'Not a measured catalog tuple transaction wait')
            save(lane,'implicit-observed-wait',wait)
            holder.execute('ROLLBACK;','release')
        no_effects(r,db,'implicit',before,state,trace,lane,validator)
        record(r,CASES[10],sqlstate='55P03',elapsed_seconds=elapsed,wait_event='transactionid',explicit_nowait_passed=True)

    with database(r,'timeout_deadline') as db:
        setup(r,db,'timeout-deadline',body)
        before=capture(lane,validator,db,'deadline-before')
        state=_state(r,db,'deadline-state');trace=_trace(r,db,'deadline-trace')
        sql,_=compile_sql(candidate,before,validator,lane,'deadline',fault='deadline_after_payload')
        # Parent harness's generic query watchdog is 60s. Use an owned psql session
        # and independently observe the backend while the fixed 120s deadline runs.
        process=r.session("SET application_name='timeout_deadline_waiter';"+sql,'timeout_deadline_waiter',db)
        started=time.monotonic()
        time.sleep(25)
        require(process.poll() is None,'Visible 20s reset incorrectly ended the 120s statement')
        alive=json.loads(r.query("SELECT pg_catalog.jsonb_build_object('state',state,'wait_event',wait_event) FROM pg_catalog.pg_stat_activity WHERE application_name='timeout_deadline_waiter';",'deadline-alive-past20',db,user='supabase_admin').stdout)
        require(alive=={'state':'active','wait_event':'PgSleep'},'No actual fixed timeout fault running after 20s')
        save(lane,'deadline-alive-past20',alive)
        r.release(process,'\\q')
        # Only this known fixture process gets a 130s join, never a new deadline.
        if process.stdin is not None: process.stdin.close();process.stdin=None
        stdout,_=process.communicate(timeout=130)
        (r.output/'logs/deadline-result.stdout').write_text(stdout)
        elapsed=time.monotonic()-started
        require(process.returncode==3 and re.search(r'^ERROR:\s+57014:',stdout,re.M)
                and 'statement timeout' in stdout and 115<=elapsed<140,
                'Expected effective prearmed 120s statement timeout')
        require('TEST_ONLY_TIMEOUT_STAGE:payload:20s/3s' in stdout,'Timeout did not follow unchanged canonical payload')
        no_effects(r,db,'deadline',before,state,trace,lane,validator)
        record(r,CASES[11],elapsed_seconds=elapsed,sqlstate='57014',effective_deadline_seconds=120,
               visible_inner_setting='20s',injection='FIXED_TEST_ONLY_SLEEP_AFTER_PAYLOAD',no_sequence_allocation=True)

    with database(r,'timeout_rollback') as db:
        setup(r,db,'timeout-rollback',body)
        before=capture(lane,validator,db,'rollback-before')
        sql,_=compile_sql(candidate,before,validator,lane,'rollback',fault='after_insert')
        response=r.query(sql,'rollback-after-insert',db,expected=3)
        require('CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT' in response.stdout,'Missing fixed failure')
        after=capture(lane,validator,db,'rollback-after')
        require(rejected(before,after,validator),'Rollback called committed')
        old=before[0]['sequence_state']['result']['sequence_state'];new=after[0]['sequence_state']['result']['sequence_state']
        require(int(new['last_value'])==int(old['last_value'])+int(old['is_called']) and new['is_called'], 'Expected sequence allocation remains')
        for key in ('catalog','drizzle_history','supabase_manifest_before'):
            require(before[0][key]['result']==after[0][key]['result'],'Transactional rollback changed projection')
        record(r,CASES[12],sequence_gap_not_rollback_proof=True)
        state=_state(r,db,'gap-state');trace=_trace(r,db,'gap-trace')
        retry=r.query(sql,'gap-retry',db,expected=3)
        require('CRM_TRANSACTION_PREIMAGE_SEQUENCE' in retry.stdout,'Gap retry was not blocked')
        no_effects(r,db,'gap-retry',after,state,trace,lane,validator)
        record(r,CASES[18],same_immutable_sql_rejected=True,no_sequence_reset=True)

    with database(r,'timeout_lost') as db:
        setup(r,db,'timeout-lost',body)
        before=capture(lane,validator,db,'lost-before')
        sql,_=compile_sql(candidate,before,validator,lane,'lost')
        r.query(sql,'lost-response-discarded',db)
        after=capture(lane,validator,db,'lost-after')
        summary(lane,'lost-response',before,after,validator)
        record(r,CASES[13],all_output_discarded_before_comparison=True,real_adapter_tested=False)

    with database(r,'timeout_outer') as db:
        setup(r,db,'timeout-outer',body)
        before=capture(lane,validator,db,'outer-before')
        sql,_=compile_sql(candidate,before,validator,lane,'outer')
        # Top-level SETs before BEGIN ensure deadline is armed before outer DO.
        prelude,program=sql.split('\n',1)
        with Session(r,db,'timeout_outer_writer',lane) as writer:
            writer.execute(prelude+'BEGIN;'+program,'open-write')
            writer.keep_outer_open=True
            duplicate=r.query(sql,'concurrent-duplicate',db,expected=3)
            require('55P03' in duplicate.stdout and 'could not obtain lock' in duplicate.stdout,
                    'Concurrent identical request did not fail NOWAIT')
            record(r,CASES[15],same_immutable_candidate=True,sqlstate='55P03',no_second_effect=True)
            pending=capture(lane,validator,db,'outer-independent-pending')
            require(rejected(before,pending,validator),'Pending response loss was called committed')
            require(pending[0]['drizzle_history']['result']==before[0]['drizzle_history']['result'],
                    'Independent reader saw pending insert')
            record(r,CASES[16],independent_reader_sees_no_new_row=True,retry_permission='NOT_GRANTED')
            own=capture(SessionCapture(writer),validator,db,'outer-own')
            require('ASSIGNED_XID' in rejected(before,own,validator),'Own row called committed')
            writer.execute('COMMIT;','commit')
            writer.keep_outer_open=False
            after=capture(SessionCapture(writer),validator,db,'outer-after')
            summary(lane,'same-backend',before,after,validator)
            require(after[0]['discovery']['result']['context']['statement_timeout']=='2min'
                    and after[0]['discovery']['result']['context']['lock_timeout']=='0','Outer commit profile not restored')
        record(r,CASES[14],same_backend_after_commit=True,own_uncommitted_row_rejected=True)
    r.result['formally_validated_projections']=validator.formally_validated
