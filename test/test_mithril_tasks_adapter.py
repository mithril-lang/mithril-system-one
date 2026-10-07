import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
secret = types.ModuleType("agent.secret_scope")
secret.get_secret = lambda *args: ""
sys.modules.setdefault("agent", types.ModuleType("agent"))
sys.modules.setdefault("agent.secret_scope", secret)
spec = importlib.util.spec_from_file_location("mithril_tasks_plugin", ROOT / "adapters/hermes/mithril-tasks/__init__.py")
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)


class AdapterTests(unittest.TestCase):
    def test_fixed_command_json_input_and_credential_boundary(self):
        with patch.object(plugin.subprocess, "run", return_value=types.SimpleNamespace(stdout=json.dumps({"row": {"success": True}}), returncode=0)) as call:
            args = {"task_id": "repair-import", "method": "ontology", "source": '"; echo unsafe'}
            self.assertTrue(plugin.invoke(ROOT, args, "owning-test-key")["ok"])
            positional, options = call.call_args
            self.assertEqual(positional[0][1:], [str(ROOT / "bin/mithril-task.mjs"), "agent", "--stdin"])
            self.assertEqual(json.loads(options["input"]), args)
            self.assertFalse(options["shell"])
            self.assertNotIn("MITHRIL_API_KEY", options["env"])

    def test_inference_credential_only_passed_to_owning_fixed_child(self):
        with patch.object(plugin.subprocess, "run", return_value=types.SimpleNamespace(stdout=json.dumps({"row": {"success": False}}), returncode=1)) as call:
            result = plugin.invoke(ROOT, {"task_id": "repair-summary", "method": "system-one"}, "owning-test-key")
            self.assertFalse(result["ok"])
            self.assertEqual(call.call_args.kwargs["env"]["MITHRIL_API_KEY"], "owning-test-key")
            self.assertNotIn("owning-test-key", call.call_args.kwargs["input"])

    def test_timeout_is_unknown_and_never_retried(self):
        with patch.object(plugin.subprocess, "run", side_effect=subprocess.TimeoutExpired("node", 95)) as call:
            result = plugin.invoke(ROOT, {"task_id": "compact-refactor", "method": "ontology"})
            self.assertEqual(result["error"], "run_outcome_unknown")
            self.assertFalse(result["retry"])
            self.assertEqual(call.call_count, 1)

    def test_extra_keys_are_refused_before_process(self):
        with patch.object(plugin.subprocess, "run") as call:
            self.assertFalse(plugin.invoke(ROOT, {"task_id": "create-report", "command": "unsafe"})["ok"])
            call.assert_not_called()

    def test_registration_exposes_bounded_task_tool(self):
        ctx = types.SimpleNamespace(register_tool=lambda **kwargs: setattr(ctx, "tool", kwargs), get_config=lambda name: str(ROOT))
        plugin.register(ctx)
        self.assertEqual(ctx.tool["name"], "mithril_task")
        self.assertFalse(ctx.tool["schema"]["parameters"]["additionalProperties"])
        self.assertTrue(ctx.tool["check_fn"]())
