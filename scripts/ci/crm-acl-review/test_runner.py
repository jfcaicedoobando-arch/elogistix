import json,unittest,copy,io,tempfile
from unittest.mock import Mock
from pathlib import Path
from run_ci import Runner,CRMRunner,gate,BASE,BRANCH,REPOSITORY,OWNER,IMAGE
class RunnerSafety(unittest.TestCase):
 def test_cleanup_preserves_exited_client_primary_error(self):
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp);(out/'logs').mkdir();r=Runner(out,'offline')
   p=Mock();p.poll.return_value=3;p.wait.return_value=3;p.stdin=None;p.stderr=None;p.stdout=io.StringIO();p._crm_label='competitor'
   p.communicate.return_value=('ERROR:  XX000: tuple concurrently updated\n',None)
   r.sessions=[p];r.close_sessions()
   self.assertTrue(r.result['owned_psql_clients_closed'])
   self.assertIn('XX000',(out/'logs/cleanup-session-competitor.stdout').read_text())
   p.terminate.assert_not_called()
 def test_finish_exited_client_preserves_error_after_broken_pipe(self):
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp);(out/'logs').mkdir();r=CRMRunner(out,'offline')
   p=Mock();p.stdin.close.side_effect=BrokenPipeError();p.returncode=3;p.args=[]
   p.communicate.return_value=('ERROR:  XX000: tuple concurrently updated\n',None)
   r.sessions=[p];result=r.finish_session(p,'failed-competitor',expected=None)
   self.assertEqual(result.returncode,3);self.assertIn('XX000',result.stdout)
   self.assertIsNone(p.stdin)
 def test_isolation(self):
  r=Runner(Path('/tmp/offline-do-not-run'),'offline');args=r.create_args()
  for flag in ['--network','--read-only','--cap-drop','--security-opt','--user','--tmpfs']:self.assertIn(flag,args)
  self.assertEqual(args[args.index('--network')+1],'none');self.assertIn('no-new-privileges',args)
  self.assertRegex(IMAGE,r'^postgres@sha256:[0-9a-f]{64}$')
 def test_sql_not_in_shell(self):
  r=CRMRunner(Path('/tmp/offline-do-not-run'),'offline');r.cid='abc';a=r.psql_args('crm_acl_fixture_test')
  self.assertIn('exec "$@" 2>&1',a);self.assertNotIn('-c',a[a.index('psql'):]);self.assertIn('ON_ERROR_STOP=1',a)
  for bad in ['prod','postgres;DROP DATABASE prod','crm_acl_fixture_x;']:
   with self.assertRaises(RuntimeError):r.psql_args(bad)
 def test_gate(self):
  repo={'full_name':REPOSITORY,'owner':{'login':OWNER}};sha='a'*40
  e={'action':'opened','repository':repo,'pull_request':{'draft':True,'base':{'repo':repo,'ref':'main','sha':BASE},'head':{'repo':repo,'ref':BRANCH,'sha':sha}}}
  env={'GITHUB_EVENT_NAME':'pull_request','GITHUB_REPOSITORY':REPOSITORY}
  self.assertEqual(gate(e,env,sha),sha)
  for field,value in [('draft',False)]:
   bad=copy.deepcopy(e);bad['pull_request'][field]=value
   with self.assertRaises(RuntimeError):gate(bad,env,sha)
  bad=copy.deepcopy(e);bad['pull_request']['base']['sha']='b'*40
  with self.assertRaises(RuntimeError):gate(bad,env,sha)
if __name__=='__main__':unittest.main()
