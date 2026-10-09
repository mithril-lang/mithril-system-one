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
        registered = []
        ctx = types.SimpleNamespace(register_tool=lambda **kwargs: registered.append(kwargs), get_config=lambda name: str(ROOT))
        plugin.register(ctx)
        self.assertEqual([t["name"] for t in registered], ["mithril_task", "mithril_workflow", "mithril_codegraph"])
        self.assertTrue(all(not t["schema"]["parameters"]["additionalProperties"] for t in registered))
        self.assertTrue(all(t["check_fn"]() for t in registered))

    def test_success_omits_null_error_and_failures_retain_their_cause(self):
        for row in ({"success": True, "error": None}, {"success": False, "error": "plan_refused"}):
            with patch.object(plugin.subprocess, "run", return_value=types.SimpleNamespace(stdout=json.dumps({"row": row}), returncode=0 if row["success"] else 1)):
                value = plugin.invoke(ROOT, {"task_id": "compact-refactor", "method": "ontology"})
                self.assertEqual(value["ok"], row["success"])
                if row["success"]:
                    self.assertNotIn("error", value["result"]["row"])
                else:
                    self.assertEqual(value["result"]["row"]["error"], "plan_refused")

    def test_successful_workflow_rows_do_not_look_like_native_failures(self):
        value = {"row": {"success": True, "error": None}, "tasks": [
            {"row": {"success": True, "error": None}},
            {"row": {"success": False, "error": "plan_refused"}}]}
        with patch.object(plugin.subprocess, "run", return_value=types.SimpleNamespace(stdout=json.dumps(value), returncode=0)):
            result = plugin.invoke(ROOT, {"task_ids": ["dynamic-refactor"], "method": "ontology"}, workflow=True)
            self.assertNotIn("error", result["result"]["tasks"][0]["row"])
            self.assertEqual(result["result"]["tasks"][1]["row"]["error"], "plan_refused")

    def test_graph_roots_are_owner_configuration_and_graph_child_has_no_credential(self):
        with patch.object(plugin.subprocess, "run", return_value=types.SimpleNamespace(stdout=json.dumps({"ok": True, "result": {"nodes": 1}}), returncode=0)) as call:
            self.assertTrue(plugin.invoke_graph(ROOT, {"action": "query", "request": {"operation": "status"}}, ROOT, ROOT)["ok"])
            self.assertEqual(call.call_args.args[0][1:], [str(ROOT / "bin/mithril-codegraph.mjs"), "--stdin"])
            self.assertNotIn("MITHRIL_API_KEY", call.call_args.kwargs["env"])
            self.assertEqual(call.call_args.kwargs["env"]["MITHRIL_CODEGRAPH_REPOSITORY"], str(ROOT))
            self.assertFalse(call.call_args.kwargs["shell"])

    def test_graph_arguments_cannot_select_roots_or_commands(self):
        with patch.object(plugin.subprocess, "run") as call:
            self.assertFalse(plugin.invoke_graph(ROOT, {"action": "query", "root": "/tmp"}, ROOT, ROOT)["ok"])
            call.assert_not_called()

    def test_graph_task_requires_configuration_and_preserves_existing_task_environment(self):
        args = {"task_id": "dynamic-refactor", "method": "ontology", "codegraph": {"target": "policy.mith", "request": {"operation": "status"}}}
        with patch.object(plugin.subprocess, "run", return_value=types.SimpleNamespace(stdout=json.dumps({"row": {"success": True}}), returncode=0)) as call:
            self.assertEqual(plugin.invoke(ROOT, args)["error"], "codegraph_configuration_required")
            call.assert_not_called()
            self.assertTrue(plugin.invoke(ROOT, args, codegraph_runtime_root=ROOT, codegraph_repository=ROOT)["ok"])
            self.assertEqual(call.call_args.kwargs["timeout"], 700)
