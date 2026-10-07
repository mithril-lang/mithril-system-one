import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('mithril_code_client',Path(__file__).resolve().parents[1]/'adapters/hermes/mithril-code/client.py')
client=importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)
class ClientTests(unittest.TestCase):
    def test_origin_and_invalid_input_refusal(self):
        for url in ['https://evil.example','https://code.mithril.fund?token=x','http://outside.example']:
            self.assertFalse(client.call_mithril(url,'test-token','run','report')['ok'])
        self.assertFalse(client.call_mithril('https://code.mithril.fund','','run','report')['ok'])
        self.assertFalse(client.call_mithril('https://code.mithril.fund','test','run','')['ok'])
    def test_uncertain_post_never_retries_or_echoes_credential(self):
        with patch.object(client,'build_opener') as opener:
            opener.return_value.open.side_effect=TimeoutError('private-token')
            result=client.call_mithril('https://code.mithril.fund','private-token','run','report')
            self.assertEqual(result,{'ok':False,'error':'run_outcome_unknown'})
            self.assertEqual(opener.return_value.open.call_count,1)
    def test_incomplete_language_result_is_not_verified(self):
        with self.assertRaises(ValueError):
            client.validate_result({'format':'mithril.language-project/v1','verified':True})
if __name__=='__main__': unittest.main()
