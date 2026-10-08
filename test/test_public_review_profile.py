import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('profile_installer', ROOT / 'scripts/install-public-review-profile.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class ProfileTests(unittest.TestCase):
    def test_independent_idempotent_profile_without_credentials(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp).resolve() / 'hermes'
            home.mkdir()
            (home / '.env').write_text('MITHRIL_API_KEY=never-copy-fixture\n')
            installer.install(ROOT, home, True)
            target = home / 'profiles' / installer.PROFILE
            installer.install(ROOT, home, True)
            self.assertFalse((target / '.env').exists())
            self.assertFalse((target / 'cron').exists())
            self.assertEqual((target / 'config.yaml').stat().st_mode & 0o777, 0o600)
            self.assertNotIn('never-copy-fixture', (target / 'config.yaml').read_text())
            self.assertTrue((target / 'plugins/mithril-public-review/__init__.py').exists())
            (target / 'SOUL.md').write_text('user edit')
            with self.assertRaises(ValueError):
                installer.install(ROOT, home, True)
            self.assertEqual((target / 'SOUL.md').read_text(), 'user edit')

    def test_symlink_destination_refused_before_any_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp).resolve() / 'hermes'
            home.mkdir()
            (home / 'profiles').symlink_to(Path(tmp))
            with self.assertRaises(ValueError):
                installer.install(ROOT, home, True)
            self.assertFalse((Path(tmp) / installer.PROFILE).exists())
