import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('terms_plugin', ROOT / 'adapters/hermes/mithril-terms-review/__init__.py')
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)


class AdapterTest(unittest.TestCase):
    def test_native_registration_and_real_dispatch(self):
        class Context:
            def get_config(self, key): return str(ROOT)
            def register_tool(self, **kwargs): self.tool = kwargs
        ctx = Context()
        plugin.register(ctx)
        args = {'service': {'name': 'Fixture only', 'plan': 'sample', 'jurisdiction': 'unknown'}, 'documents': [{
            'kind': 'terms', 'url': 'https://example.org/terms', 'retrievedAt': '2026-10-08T00:00:00Z',
            'language': 'en', 'text': 'No refunds.', 'sha256': hashlib.sha256(b'No refunds.').hexdigest()}]}
        result = json.loads(ctx.tool['handler'](args))
        self.assertEqual(result['findings'][0]['rule'], 'refund')
        self.assertFalse(result['publication']['autoPublish'])
        self.assertEqual(ctx.tool['name'], 'mithril_terms_review')

    def test_refusal_never_echoes_bad_input(self):
        result = plugin.invoke(ROOT, {'private-secret': 'do-not-print'})
        self.assertFalse(result['ok'])
        self.assertNotIn('do-not-print', json.dumps(result))
