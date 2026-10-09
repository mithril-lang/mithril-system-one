"""Opt-in local Mithril task harness. No arbitrary shell or workspace writes."""
import json
import os
from pathlib import Path
import shutil
import subprocess
from agent.secret_scope import get_secret


def invoke(root, args, key="", *, workflow=False, codegraph_runtime_root="", codegraph_repository=""):
    try:
        path = Path(root).expanduser().resolve(strict=True)
        package = json.loads((path / "package.json").read_text())
        if package.get("name") != "@mithril/system-one":
            raise ValueError()
        script = path / "bin" / ("mithril-workflow.mjs" if workflow else "mithril-task.mjs")
        if not script.is_file() or not shutil.which("node"):
            raise ValueError()
        if not isinstance(args, dict) or set(args) - ({"task_ids", "method", "codegraph"} if workflow else {"task_id", "method", "source", "codegraph"}):
            raise ValueError()
        payload = json.dumps(args)
        if len(payload.encode()) > 16384:
            raise ValueError()
        # Fixed command and minimal environment. Input remains JSON data;
        # the hosted compiler never receives this inference credential.
        env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR") if k in os.environ}
        if "codegraph" in args:
            if not codegraph_runtime_root or not codegraph_repository:
                return {"ok": False, "error": "codegraph_configuration_required", "retry": False}
            env["MITHRIL_CODEGRAPH_RUNTIME_ROOT"] = str(Path(codegraph_runtime_root).expanduser().resolve(strict=True))
            env["MITHRIL_CODEGRAPH_REPOSITORY"] = str(Path(codegraph_repository).expanduser().resolve(strict=True))
        if args.get("method", "ontology") == "system-one":
            if not isinstance(key, str) or not key or len(key) > 1024 or "\n" in key or "\r" in key:
                return {"ok": False, "error": "mithril_authorization_required"}
            env["MITHRIL_API_KEY"] = key
        result = subprocess.run([shutil.which("node"), str(script), *([] if workflow else ["agent"]), "--stdin"],
                                input=payload, text=True, capture_output=True,
                                timeout=(2100 if workflow else 700) if "codegraph" in args else (285 if workflow else 95), env=env, cwd=path, shell=False)
        if len(result.stdout.encode()) > 2_000_000:
            raise ValueError()
        value = json.loads(result.stdout)
        if not isinstance(value, dict) or not isinstance(value.get("row"), dict):
            return {"ok": False, "error": "mithril_task_failed", "retry": False}
        # Hermes's string-result classifier treats an early `"error"` key as
        # failure even when its value is null. Preserve real failure codes;
        # omit only the null placeholder on a successful task.
        if value["row"].get("success") is True and value["row"].get("error") is None:
            value["row"].pop("error", None)
        for task in value.get("tasks", []):
            row = task.get("row", {}) if isinstance(task, dict) else {}
            if row.get("success") is True and row.get("error") is None:
                row.pop("error", None)
        return {"ok": value["row"].get("success") is True, "result": value}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "run_outcome_unknown", "retry": False}
    except (ValueError, TypeError, OSError):
        return {"ok": False, "error": "mithril_task_unavailable", "retry": False}


def invoke_graph(root, args, codegraph_runtime_root="", codegraph_repository=""):
    try:
        path = Path(root).expanduser().resolve(strict=True)
        if json.loads((path / "package.json").read_text()).get("name") != "@mithril/system-one":
            raise ValueError()
        if not isinstance(args, dict) or set(args) - {"action", "request"}:
            raise ValueError()
        if not codegraph_runtime_root or not codegraph_repository:
            return {"ok": False, "error": "codegraph_configuration_required", "retry": False}
        payload = json.dumps(args)
        if len(payload.encode()) > 16384:
            raise ValueError()
        env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR") if k in os.environ}
        env["MITHRIL_CODEGRAPH_RUNTIME_ROOT"] = str(Path(codegraph_runtime_root).expanduser().resolve(strict=True))
        env["MITHRIL_CODEGRAPH_REPOSITORY"] = str(Path(codegraph_repository).expanduser().resolve(strict=True))
        result = subprocess.run([shutil.which("node"), str(path / "bin/mithril-codegraph.mjs"), "--stdin"],
                                input=payload, text=True, capture_output=True, timeout=350, env=env, cwd=path, shell=False)
        if len(result.stdout.encode()) > 2_000_000:
            raise ValueError()
        value = json.loads(result.stdout)
        if not isinstance(value, dict) or not isinstance(value.get("ok"), bool):
            raise ValueError()
        return value
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "codegraph_outcome_unknown", "retry": False}
    except (ValueError, TypeError, OSError):
        return {"ok": False, "error": "codegraph_unavailable", "retry": False}


GRAPH_REQUEST = {"type": "object", "required": ["operation"], "additionalProperties": False,
                 "properties": {"operation": {"type": "string", "enum": ["status", "search", "explore", "catalog", "content", "node", "callers", "callees", "impact", "neighbors", "path", "communities", "community"]},
                                **{k: {"type": "string", "maxLength": n} for k, n in [("query", 256), ("node", 512), ("from", 512), ("to", 512), ("community", 512), ("kind", 256), ("revision", 80)]},
                                **{k: {"type": "integer", "minimum": low, "maximum": high} for k, low, high in [("limit", 1, 200), ("depth", 1, 16), ("offset", 0, 67108864)]}}}
GRAPH_CONTEXT = {"type": "object", "required": ["target", "request"], "additionalProperties": False,
                 "properties": {"target": {"type": "string", "maxLength": 240}, "request": GRAPH_REQUEST}}


def register(ctx):
    def graph_config():
        return {"codegraph_runtime_root": ctx.get_config("codegraph_runtime_root") or "",
                "codegraph_repository": ctx.get_config("codegraph_repository") or ""}

    def handler(args, **kwargs):
        return json.dumps(invoke(ctx.get_config("system_one_root") or "",
                                 args, get_secret("MITHRIL_API_KEY", ""), **graph_config()), ensure_ascii=False)

    ctx.register_tool(
        name="mithril_task", toolset="mithril_tasks", handler=handler,
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="🧩",
        description="Compile and verify a supported Mithril task",
        schema={"name": "mithril_task", "description": (
            "Run one original bounded Mithril task: create-report, repair-summary, migrate-directory, "
            "repair-shape, repair-import, compact-refactor; dynamic-repair-inheritance, dynamic-repair-validation, dynamic-refactor. ontology uses deterministic catalog rules; "
            "system-one uses one Mithril API proposal. Returns candidate source and real compiler "
            "receipts with exact output/refactor checks. Optional codegraph context saves private isolated candidate archives; original source is retained. No model commands, commits or publishing. "
            "Never retry unknown outcomes. Dynamic tasks execute pinned Mithril OWL/SHACL on 11 Todo input snapshots; static tasks render documents."),
            "parameters": {"type": "object", "properties": {
                "task_id": {"type": "string", "enum": ["create-report", "repair-summary", "migrate-directory", "repair-shape", "repair-import", "compact-refactor", "dynamic-repair-inheritance", "dynamic-repair-validation", "dynamic-refactor"]},
                "method": {"type": "string", "enum": ["ontology", "system-one"]},
                "source": {"type": "string", "maxLength": 8192}, "codegraph": GRAPH_CONTEXT},
                "required": ["task_id", "method"], "additionalProperties": False}})

    def workflow_handler(args, **kwargs):
        return json.dumps(invoke(ctx.get_config("system_one_root") or "", args,
                                 get_secret("MITHRIL_API_KEY", ""), workflow=True, **graph_config()), ensure_ascii=False)

    ctx.register_tool(
        name="mithril_workflow", toolset="mithril_tasks", handler=workflow_handler,
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="🧩",
        description="Run a bounded Mithril coding workflow",
        schema={"name": "mithril_workflow", "description": (
            "Run 1–3 distinct Mithril tasks in order through the shared harness. Stop on the first "
            "failure or unknown outcome; no retries or publication. Optional codegraph contexts save independent candidate previews without applying originals. ontology is "
            "deterministic; system-one uses the owning profile Mithril API credential."),
            "parameters": {"type": "object", "properties": {
                "task_ids": {"type": "array", "items": {"type": "string", "enum": [
                    "create-report", "repair-summary", "migrate-directory", "repair-shape",
                    "repair-import", "compact-refactor", "dynamic-repair-inheritance",
                    "dynamic-repair-validation", "dynamic-refactor"]}, "minItems": 1,
                    "maxItems": 3, "uniqueItems": True},
                "method": {"type": "string", "enum": ["ontology", "system-one"]},
                "codegraph": {"type": "array", "items": GRAPH_CONTEXT, "minItems": 1, "maxItems": 3}},
                "required": ["task_ids", "method"], "additionalProperties": False}})

    ctx.register_tool(
        name="mithril_codegraph", toolset="mithril_tasks", emoji="🕸️",
        handler=lambda args, **kwargs: json.dumps(invoke_graph(ctx.get_config("system_one_root") or "", args, **graph_config()), ensure_ascii=False),
        check_fn=lambda: bool(ctx.get_config("system_one_root") and ctx.get_config("codegraph_runtime_root") and ctx.get_config("codegraph_repository")),
        description="Explore or reason over the configured local code graph",
        schema={"name": "mithril_codegraph", "description": "Read graph context, update a private index or infer from saved Mithril premises. Explicit rebuild migrates old caches. No original source edits, credentials or publication.",
                "parameters": {"type": "object", "required": ["action"], "additionalProperties": False,
                               "properties": {"action": {"type": "string", "enum": ["query", "index", "rebuild", "reason"]}, "request": GRAPH_REQUEST}}})
