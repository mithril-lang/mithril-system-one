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

class UpgradeTests(unittest.TestCase):
    def test_only_hash_reviewed_files_upgrade_and_credentials_are_preserved(self):
        import hashlib
        import json
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp).resolve()
            root = base / 'source'
            import shutil
            shutil.copytree(ROOT / 'profiles', root / 'profiles')
            shutil.copytree(ROOT / 'adapters', root / 'adapters')
            home = base / 'hermes'
            installer.install(root, home, True)
            target = home / 'profiles' / installer.PROFILE
            (target / '.env').write_text('MITHRIL_API_KEY=own-profile-fixture\n')
            plugin = target / 'plugins/mithril-public-review/plugin.yaml'
            old = plugin.read_text()
            packaged = root / 'adapters/hermes/mithril-public-review/plugin.yaml'
            packaged.write_text(old.replace('0.4.1', '0.5.0'))
            hashes = root / 'profiles' / installer.PROFILE / 'reviewed-upgrade-hashes.json'
            hashes.write_text(json.dumps({'plugins/mithril-public-review/plugin.yaml': hashlib.sha256(old.encode()).hexdigest()}))
            with self.assertRaises(ValueError):
                installer.install(root, home, True)
            installer.install(root, home, True, True)
            self.assertIn('0.5.0', plugin.read_text())
            self.assertEqual((target / '.env').read_text(), 'MITHRIL_API_KEY=own-profile-fixture\n')
            self.assertEqual(plugin.stat().st_mode & 0o777, 0o600)
            plugin.write_text('operator edited this')
            with self.assertRaises(ValueError):
                installer.install(root, home, True, True)

    def test_tool_only_upgrade_preserves_operator_config(self):
        import shutil
        import hashlib
        import json
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve() / 'source'
            shutil.copytree(ROOT / 'profiles', root / 'profiles')
            shutil.copytree(ROOT / 'adapters', root / 'adapters')
            home = Path(tmp).resolve() / 'hermes'
            installer.install(root, home, True)
            target = home / 'profiles' / installer.PROFILE
            config = target / 'config.yaml'
            original = config.read_text() + '\n# operator custom settings\n'
            config.write_text(original)
            plugin = root / 'adapters/hermes/mithril-public-review/plugin.yaml'
            old = plugin.read_bytes()
            plugin.write_text(old.decode().replace('0.4.1', '0.5.0'))
            hashes = root / 'profiles' / installer.PROFILE / 'reviewed-upgrade-hashes.json'
            hashes.write_text(json.dumps({'plugins/mithril-public-review/plugin.yaml': [hashlib.sha256(old).hexdigest()]}))
            installer.install(root, home, True, True, True)
            self.assertEqual(config.read_text(), original)
            self.assertIn('0.5.0', (target / 'plugins/mithril-public-review/plugin.yaml').read_text())
