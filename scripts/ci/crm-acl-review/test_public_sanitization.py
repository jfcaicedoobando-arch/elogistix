import hashlib,json,unittest
from adapter import ROOT
class PublicSanitization(unittest.TestCase):
 def test_public_binding_and_normalized_code_hash(self):
  source=(ROOT/'inputs/proposed-owner-only.sql').read_text();parts=source.split('$contract$')
  self.assertEqual(len(parts),3);self.assertTrue(json.loads(parts[1])['fixture_only'])
  normalized=parts[0]+'$contract$<BINDING>$contract$'+parts[2]
  manifest=json.loads((ROOT/'input-manifest.json').read_text())
  self.assertEqual(hashlib.sha256(normalized.encode()).hexdigest(),manifest['sanitization']['normalized_candidate_sha256'])
  self.assertEqual(manifest['sanitization']['advisory_pair'],[817401,817402])
  self.assertIn('pg_try_advisory_xact_lock(817401,817402)',normalized)
if __name__=='__main__':unittest.main()
