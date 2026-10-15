"""Offline rejection tests. No SQL, Docker, network or emulated native success."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("independent_runner_test",HERE/"run_ci.py")
r=importlib.util.module_from_spec(spec);sys.modules[spec.name]=r;spec.loader.exec_module(r)

class AdapterTests(unittest.TestCase):
 def test_local_fails_before_subprocess(self):
  with patch.dict(r.os.environ,{},clear=True),patch.object(r.subprocess,"check_output") as cmd:
   with self.assertRaises(RuntimeError):r.run(HERE/"never-created")
   cmd.assert_not_called()
 def test_exact_source_inventory_and_provider_contract(self):
  frozen,pins=r.verify_inputs()
  self.assertEqual(len(pins["files"]),39)
  review=r.module("independent_provider_test",r.REVIEW/"suite.py")
  self.assertEqual(tuple(c["id"] for c in review.CASES),r.CASE_IDS)
  bm=r.module("independent_author_test",r.BEHAVIOR/"run_ci.py")
  sources,_=bm.verify_inputs()
  sql=review.suite_sql(r.CASE_IDS[0],{name:sources["sql/"+name] for name in review.CONTRACT["external_sources"]},author_fix_head=r.AUTHOR)
  self.assertTrue(sql.startswith(sources["sql/fixture.sql"]))
 def test_acceptance_requires_native_assertions_exact_stages_and_owned_cleanup(self):
  result={"cleanup":"confirmed_stopped_and_removed","shutdown_confirmed":True,"pg_status_3_and_no_pid":True,"owned_psql_clients_closed":True,"install_verified":True,"stages":[{"stage":"native","status":"PASS"}]}
  native={"status":"ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP"}
  self.assertTrue(r.accept_case(result,native,["native"]))
  for key in ("cleanup","shutdown_confirmed","pg_status_3_and_no_pid","owned_psql_clients_closed","install_verified","stages"):
   bad=copy.deepcopy(result);bad.pop(key)
   with self.subTest(key=key):self.assertFalse(r.accept_case(bad,native,["native"]))
  self.assertFalse(r.accept_case(result,{"status":"FAIL"},["native"]))
  self.assertFalse(r.accept_case(result,native,["different"]))
 def test_every_native_case_is_its_own_owned_cluster(self):
  code=(HERE/"run_ci.py").read_text()
  self.assertIn('r = ReviewRunner(output, uuid.uuid4().hex)',code)
  self.assertIn('for case in review.CASES:',code)
  self.assertIn('r.start()',code)
  self.assertIn('finally: r.save()',code)
 def test_native_parser_has_no_cleanup_authority(self):
  self.assertFalse(r.accept_case({"stages":[],"install_verified":True},{"status":"ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP"},[]))
 def test_inventory_rejects_escaping_inputs(self):
  for rel in ("../x","/x","C:/x","x\\y"):
   with self.subTest(rel=rel),self.assertRaises(RuntimeError):r.inventory(HERE,[{"path":rel,"bytes":0,"sha256":r.sha(b"")}])
 def test_scope_cannot_be_inferred_from_offline_evidence(self):
  code=(HERE/"run_ci.py").read_text()
  self.assertNotIn("offline-evidence.json",code)
  self.assertIn('"business_commit":"NOT_RUN"',code)
  self.assertIn('"sequence_rollback":"NOT_ESTABLISHED"',code)
 def test_imported_author_and_review_sources_remain_separate_from_adapter(self):
  frozen,pins=r.verify_inputs()
  self.assertTrue(all(not row["path"].startswith("scripts/ci/demo-financial-commit-review/") for row in pins["files"]))
  self.assertNotIn("suite.py",frozen)

if __name__=="__main__":unittest.main()
