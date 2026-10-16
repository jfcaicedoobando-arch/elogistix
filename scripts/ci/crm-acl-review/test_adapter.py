import copy,json,unittest
from adapter import *
class AdapterTests(unittest.TestCase):
 def test_hashes(self): self.assertGreater(len(verify_inputs()['files']),7)
 def test_expand_fixture(self):
  s=fixture_sql();self.assertNotIn('\\ir ',s);self.assertNotIn('CREATE ROLE',s);self.assertIn('170006',s)
 def test_identity_only_binding(self):
  c=json.loads((ROOT/'inputs/synthetic-contract-shape.json').read_text());s=(ROOT/'inputs/proposed-owner-only.sql').read_text();b=bind_candidate(c)
  self.assertEqual(s.split('$contract$')[::2],b.split('$contract$')[::2])
 def test_bad_signature(self):
  c=json.loads((ROOT/'inputs/synthetic-contract-shape.json').read_text());c['functions'][0]['signature']='evil()'
  with self.assertRaises(ValueError):bind_candidate(c)
 def test_delimiter(self):
  c=json.loads((ROOT/'inputs/synthetic-contract-shape.json').read_text());c['injection']='$contract$'
  with self.assertRaises(ValueError):bind_candidate(c)
if __name__=='__main__':unittest.main()
