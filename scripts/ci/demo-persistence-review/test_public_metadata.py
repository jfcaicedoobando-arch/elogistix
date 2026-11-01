"""Keep public review files free of private source IDs and local profile paths."""
from pathlib import Path
import re
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[3]
PUBLIC_PATHS = (
    'docs/qa/demo-persistence',
    'scripts/ci/demo-persistence-review',
    'docs/review/demo-durable-owner-adapter-20261015',
    'docs/review/demo-authority-provider-entry-20261016',
    '.github/workflows/demo-persistence-prerequisites.yml',
)
PRIVATE_ID_PREFIX = 'lib' + 'file' + '_'
PROFILE_PATH = re.compile(r'(?i)(?:[a-z]:[\\/]+users[\\/]+|/(?:users|home)/)')


def private_metadata_categories(source):
    categories = []
    if PRIVATE_ID_PREFIX in source:
        categories.append('private source identifier')
    if PROFILE_PATH.search(source):
        categories.append('local profile path')
    return categories


class PublicMetadataTests(unittest.TestCase):
    def test_detection_uses_synthetic_values_only(self):
        identifier = PRIVATE_ID_PREFIX + 'SYNTHETIC'
        windows_path = chr(92).join(('C:', 'Users', 'SYNTHETIC', 'input.zip'))
        unix_path = '/'.join(('', 'home', 'SYNTHETIC', 'input.zip'))
        self.assertEqual(private_metadata_categories(identifier), ['private source identifier'])
        self.assertEqual(private_metadata_categories(windows_path), ['local profile path'])
        self.assertEqual(private_metadata_categories(unix_path), ['local profile path'])
        self.assertEqual(private_metadata_categories('Elogistix-persistencia-propuesta.zip'), [])

    def test_tracked_public_review_files_have_no_private_metadata(self):
        response = subprocess.run(['git', 'ls-files', '-z', '--', *PUBLIC_PATHS],
                                  cwd=ROOT, check=True, capture_output=True)
        names = [name for name in response.stdout.decode('utf-8').split('\x00') if name]
        self.assertTrue(names, 'Public review files must be tracked')
        for name in names:
            with self.subTest(path=name):
                source = (ROOT / name).read_text(encoding='utf-8')
                self.assertEqual(private_metadata_categories(source), [],
                                 'Private metadata category detected in public review file')


if __name__ == '__main__':
    unittest.main()
