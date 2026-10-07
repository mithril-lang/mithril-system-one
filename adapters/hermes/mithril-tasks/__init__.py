"""Opt-in local Mithril task harness. No arbitrary shell or workspace writes."""
import json
import os
from pathlib import Path
import shutil
import subprocess
from agent.secret_scope import get_secret


def invoke(root, args, key=""):
    try:
        path = Path(root).expanduser().resolve(strict=True)
        package = json.loads((path / "package.json").read_text())
        if package.get("name") != "@mithril/system-one":
            raise ValueError()
        script = path / "bin" / "mithril-task.mjs"
        if not script.is_file() or not shutil.which("node"):
            raise ValueError()
        if not isinstance(args, dict) or set(args) - {"task_id", "method", "source"}:
            raise ValueError()
        payload = json.dumps(args)
        if len(payload.encode()) > 16384:
            raise ValueError()
        # Fixed command and minimal environment. Input remains JSON data;
        # the hosted compiler never receives this inference credential.
        env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR") if k in os.environ}
        if args.get("method", "ontology") == "system-one":
            if not isinstance(key, str) or not key or len(key) > 1024 or "\n" in key or "\r" in key:
                return {"ok": False, "error": "mithril_authorization_required"}
            env["MITHRIL_API_KEY"] = key
        result = subprocess.run([shutil.which("node"), str(script), "agent", "--stdin"],
                                input=payload, text=True, capture_output=True,
                                timeout=95, env=env, cwd=path, shell=False)
        if len(result.stdout.encode()) > 2_000_000:
            raise ValueError()
        value = json.loads(result.stdout)
        if not isinstance(value, dict) or not isinstance(value.get("row"), dict):
            return {"ok": False, "error": "mithril_task_failed", "retry": False}
        return {"ok": value["row"].get("success") is True, "result": value}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "run_outcome_unknown", "retry": False}
    except (ValueError, TypeError, OSError):
        return {"ok": False, "error": "mithril_task_unavailable", "retry": False}


def register(ctx):
    def handler(args, **kwargs):
        return json.dumps(invoke(ctx.get_config("system_one_root") or "",
                                 args, get_secret("MITHRIL_API_KEY", "")), ensure_ascii=False)

    ctx.register_tool(
        name="mithril_task", toolset="mithril_tasks", handler=handler,
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="🧩",
        description="Compile and verify a supported Mithril task",
        schema={"name": "mithril_task", "description": (
            "Run one original bounded Mithril task: create-report, repair-summary, migrate-directory, "
            "repair-shape, repair-import, compact-refactor. ontology uses deterministic catalog rules; "
            "system-one uses one Mithril API proposal. Returns candidate source and real compiler "
            "receipts with exact output/refactor checks. No files, shell, commits or publishing. "
            "Never retry unknown outcomes. These are public static-document tasks."),
            "parameters": {"type": "object", "properties": {
                "task_id": {"type": "string", "enum": ["create-report", "repair-summary", "migrate-directory", "repair-shape", "repair-import", "compact-refactor"]},
                "method": {"type": "string", "enum": ["ontology", "system-one"]},
                "source": {"type": "string", "maxLength": 8192}},
                "required": ["task_id", "method"], "additionalProperties": False}})
