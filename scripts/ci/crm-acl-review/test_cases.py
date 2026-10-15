import copy,unittest
from cases import semantic
class SnapshotTests(unittest.TestCase):
 def sample(self):return {'pg_proc':[{'oid':'1','proname':'_crm_empresa_no_borrar_cliente','proacl':['postgres=X/postgres','service_role=X/postgres'],'prosrc':'body'},{'oid':'2','proname':'unrelated','proacl':['PUBLIC=X/postgres']}],'pg_shdepend':[{'classid':'1255','objid':'1','deptype':'a'},{'classid':'1255','objid':'2','deptype':'a'}],'pg_trigger':[{'oid':'10'}]}
 def test_target_acl_only(self):
  a=self.sample();b=copy.deepcopy(a);b['pg_proc'][0]['proacl']=['postgres=X/postgres'];b['pg_shdepend'].pop(0)
  self.assertEqual(semantic(a),semantic(b));self.assertNotEqual(a,b)
 def test_unrelated_acl_detected(self):
  a=self.sample();b=copy.deepcopy(a);b['pg_proc'][1]['proacl']=[];self.assertNotEqual(semantic(a),semantic(b))
 def test_body_detected(self):
  a=self.sample();b=copy.deepcopy(a);b['pg_proc'][0]['prosrc']='evil';self.assertNotEqual(semantic(a),semantic(b))
 def test_wrong_dependency_class_not_excluded(self):
  a=self.sample();b=copy.deepcopy(a);b['pg_shdepend'].append({'classid':'9999','objid':'1','deptype':'a'});self.assertNotEqual(semantic(a),semantic(b))
if __name__=='__main__':unittest.main()
