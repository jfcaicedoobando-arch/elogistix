"""Pure renderer tests with explicitly reduced TEST_ONLY doubles."""
from dataclasses import FrozenInstanceError
import copy
import hashlib
import inspect
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parent))
import timeout_profile as profile
from test_transaction_envelope import prepared

class TimeoutProfileTests(unittest.TestCase):
    def setUp(self):
        self.candidate=(profile.original.REPOSITORY/'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()
        self.state=prepared()
        self.state[0]['discovery']['capture']['database']='crm_acl_fixture_timeout_unit'
        self.state[0]['discovery']['result']['context'].update(statement_timeout='2min',lock_timeout='0')
        self.window=profile.CandidateWindow('2026-01-01T00:00:00.000000Z','2026-01-01T00:05:00.000000Z')
    def render(self,**kwargs):
        with patch.object(profile,'_prepared',return_value=self.state):
            return profile.render_timeout_proposal(self.candidate,{},validate_projection=lambda _:True,semantic_witness={},window=self.window,**kwargs)
    def synthetic(self,**kwargs):
        with patch.object(profile,'_prepared',return_value=self.state):
            return profile.render_TEST_ONLY_timeout(self.candidate,{},scope='synthetic-ci',validate_projection=lambda _:True,semantic_witness={},window=self.window,**kwargs)
    def core(self,sql):
        return re.findall(r'-- CRM_TIMEOUT_CORE_BEGIN\n([\s\S]*?)-- CRM_TIMEOUT_CORE_END',sql)[0]
    def test_public_first_action_unconditional_and_no_prelude(self):
        sql=self.render()
        self.assertIn("BEGIN\n  RAISE EXCEPTION 'CRM_TIMEOUT_NOT_ADMITTED';\n",sql)
        self.assertLess(sql.index('CRM_TIMEOUT_NOT_ADMITTED'),sql.index('set_config'))
        self.assertLess(sql.index('CRM_TIMEOUT_NOT_ADMITTED'),sql.index('v_contract :='))
        self.assertNotIn(':=',sql.split('BEGIN',1)[0])
        self.assertNotIn('SET statement_timeout',sql)
    def test_exact_shared_core_and_marker(self):
        for sql in (self.render(),self.synthetic()):
            self.assertEqual(hashlib.sha256(self.core(sql).encode()).hexdigest(),re.findall(r'CORE_SHA256:([a-f0-9]{64})',sql)[0])
        self.assertEqual(self.core(self.render()),self.core(self.synthetic()))
    def test_effective_deadline_prearmed_before_do(self):
        sql=self.synthetic()
        self.assertTrue(sql.startswith("SET statement_timeout='120s'; SET lock_timeout='0';\n"))
        self.assertEqual(sql.count("set_config('statement_timeout'"),0)
        self.assertIn("current_setting('statement_timeout') <> '2min'",sql)
    def test_lock_and_path_local_before_implicit_and_explicit_reads(self):
        core=self.core(self.render())
        at=core.index("set_config('lock_timeout','3s',true)")
        self.assertLess(at,core.index('FROM pg_catalog.pg_database'))
        self.assertLess(at,core.index('LOCK TABLE'))
        self.assertLess(core.index("set_config('search_path','pg_catalog',true)"),core.index('LOCK TABLE'))
        self.assertLess(core.index('CRM_TIMEOUT_ENTRY_SEARCH_PATH'),core.index("set_config('search_path'"))
    def test_profile_contracts_are_explicit_and_separate(self):
        sql=self.render()
        self.assertIn('TEST_ONLY_TIMEOUT_STAGE:preimage:2min/3s',sql)
        self.assertIn('TEST_ONLY_TIMEOUT_STAGE:payload:20s/3s',sql)
        core=self.core(sql)
        value=bytes.fromhex(re.findall(r"decode\('([0-9a-f]+)','hex'\)",core)[0]).decode()
        self.assertIn('"statement_timeout":"2min"',value)
        self.assertIn('"lock_timeout":"3s"',value)
        for statement,lock in [('0','0'),('20s','3s'),('2min','3s')]:
            self.state[0]['discovery']['result']['context'].update(statement_timeout=statement,lock_timeout=lock)
            with self.assertRaises(profile.original.TransactionError): self.render()
    def test_window_frozen_exact_and_before_locks_and_effects(self):
        with self.assertRaises(FrozenInstanceError): self.window.expires_at='later'
        core=self.core(self.render())
        self.assertEqual(core.count('CRM_TIMEOUT_CANDIDATE_EXPIRED_OR_NOT_YET_VALID'),3)
        self.assertLess(core.index('CRM_TIMEOUT_CANDIDATE_EXPIRED_OR_NOT_YET_VALID'),core.index('LOCK TABLE'))
        self.assertIn('>= (v_contract',core)
        self.assertNotIn('interval',core)
    def test_window_format_duration_and_type_rejected(self):
        for item in [None,{},profile.CandidateWindow('x','y'),
                     profile.CandidateWindow('2026-01-01T00:00:00.000000Z','2026-01-01T00:00:00.000000Z'),
                     profile.CandidateWindow('2026-01-01T00:00:00.000000Z','2026-01-01T00:10:00.000001Z'),
                     profile.CandidateWindow('2026-99-01T00:00:00.000000Z','2026-01-01T00:01:00.000000Z')]:
            self.window=item
            with self.assertRaises(profile.original.TransactionError): self.render()
    def test_payload_exact_bytes_not_rewritten(self):
        sql=self.render()
        self.assertIn(self.candidate.hex(),sql)
        self.assertEqual(sql.count(self.candidate.hex()),1)
        self.assertIn('EXECUTE v_sql;',sql)
        self.assertIn('32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6',sql)
    def test_only_three_fixed_faults_and_no_new_adapter(self):
        normal=self.core(self.synthetic())
        for fault,statement in [('deadline_after_payload','PERFORM pg_catalog.pg_sleep(125);'),('after_insert',"RAISE EXCEPTION 'CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT';"),('expire_before_payload','PERFORM pg_catalog.pg_sleep(4);')]:
            core=self.core(self.synthetic(fault=fault))
            self.assertEqual(core.replace(statement,'',1),normal)
        with self.assertRaises(profile.original.TransactionError): self.synthetic(fault='custom sql')
        self.assertNotIn('fault',inspect.signature(profile.render_timeout_proposal).parameters)
    def test_other_databases_reject_test_only(self):
        for db in ['postgres','crm_acl_fixture_other','real','crm_acl_fixture_timeout_x;']:
            self.state[0]['discovery']['capture']['database']=db
            with self.assertRaises(profile.original.TransactionError): self.synthetic()
    def test_replay_stays_before_payload_and_insert(self):
        core=self.core(self.render())
        self.assertLess(core.index('RETURN;'),core.index('v_payload :='))
        self.assertLess(core.index('RETURN;'),core.index('INSERT INTO drizzle'))
    def test_no_session_reset_hidden_in_core(self):
        core=self.core(self.render())
        self.assertNotIn('COMMIT;',core)
        self.assertNotIn('ROLLBACK;',core)
        self.assertNotIn("set_config('lock_timeout','0'",core)

if __name__=='__main__': unittest.main()
