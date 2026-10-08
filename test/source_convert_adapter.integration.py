import importlib.util
import json
from pathlib import Path
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("source_convert", ROOT / "adapters/hermes/mithril-source-convert/__init__.py")
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)


class SourceConverterAdapter(unittest.TestCase):
    def test_register_and_real_compiler(self):
        tools = []
        ctx = types.SimpleNamespace(register_tool=lambda **k: tools.append(k), get_config=lambda _: str(ROOT))
        plugin.register(ctx)
        self.assertEqual(tools[0]["name"], "mithril_source_convert")
        value = json.loads(tools[0]["handler"]({"language": "typescript", "source": "export const toggle = (done: boolean) => !done;"}))
        self.assertTrue(value["ok"])
        self.assertEqual(value["receipt"]["verification"]["cases"], 2)

    def test_refuse_extra_fields_and_target_execution(self):
        self.assertFalse(plugin.invoke(ROOT, {"source": "", "language": "typescript", "command": "echo unsafe"})["ok"])
        value = plugin.invoke(ROOT, {"language": "typescript", "source": "process.exit(0); export const f = (x: boolean) => x;"})
        self.assertFalse(value["ok"])
        self.assertFalse(value["retry"])

if __name__ == "__main__":
    unittest.main()
