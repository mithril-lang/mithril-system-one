"""Deterministic, bounded source-AST to executable Mithril conversion."""
import json
import os
from pathlib import Path
import shutil
import subprocess


def invoke(root, args):
    try:
        if not isinstance(args, dict) or not {"source", "language"} <= set(args) <= {"source", "language", "types"}:
            raise ValueError()
        payload = json.dumps(args)
        if len(payload.encode()) > 32768:
            raise ValueError()
        path = Path(root).expanduser().resolve(strict=True)
        if json.loads((path / "package.json").read_text()).get("name") != "@mithril/system-one":
            raise ValueError()
        env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR") if k in os.environ}
        result = subprocess.run([shutil.which("node"), str(path / "bin/mithril-convert.mjs"), "--stdin"],
                                input=payload, text=True, capture_output=True, env=env, cwd=path,
                                shell=False, timeout=60)
        if len(result.stdout.encode()) > 2_000_000:
            raise ValueError()
        value = json.loads(result.stdout)
        if result.returncode != 0 or value.get("ok") is not True:
            return {"ok": False, "error": "source_conversion_refused", "retry": False}
        return value
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "conversion_outcome_unknown", "retry": False}
    except (ValueError, TypeError, OSError):
        return {"ok": False, "error": "source_conversion_refused", "retry": False}


def register(ctx):
    ctx.register_tool(name="mithril_source_convert", toolset="mithril_source_convert",
        handler=lambda args, **kwargs: json.dumps(invoke(ctx.get_config("system_one_root") or "", args)),
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="⚙️",
        description="Compile inert JavaScript/TypeScript AST into checked executable Mithril",
        schema={"name": "mithril_source_convert", "description":
            "Convert only pure named exported functions with Boolean/Boolean-array parameters. "
            "Supports negation, conditionals, Boolean logic, equality, filter callbacks and length. "
            "Compiles actual .mith and exhaustively verifies dense arrays of length 0–8. "
            "Rejects imports, global calls, mutation, recursion and unsupported syntax. "
            "No source execution, inference credentials, files or publication. Never retry unknown outcomes.",
            "parameters": {"type": "object", "properties": {
                "source": {"type": "string", "maxLength": 16384},
                "language": {"type": "string", "enum": ["javascript", "typescript"]},
                "types": {"type": "object", "additionalProperties": {"type": "array", "maxItems": 4,
                    "items": {"type": "string", "enum": ["bool", "bool[]"]}}}},
                "required": ["source", "language"], "additionalProperties": False}})
