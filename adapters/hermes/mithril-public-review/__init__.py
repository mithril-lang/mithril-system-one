"""Inert public source review; owning profile opt-in. No inference credentials."""
import json
import os
from pathlib import Path
import shutil
import subprocess


def invoke(root, args):
    try:
        if not isinstance(args, dict) or set(args) != {"repository", "commit"}:
            raise ValueError()
        payload = json.dumps(args)
        if len(payload.encode()) > 4096:
            raise ValueError()
        path = Path(root).expanduser().resolve(strict=True)
        if json.loads((path / "package.json").read_text()).get("name") != "@mithril/system-one":
            raise ValueError()
        node = shutil.which("node")
        # No profile/provider credentials enter either source parser or compiler.
        # Target files are data only: never shell, import, npm install or tests.
        env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR") if k in os.environ}
        result = subprocess.run([node, str(path / "bin/mithril-public-review.mjs"), "--stdin"],
                                input=payload, text=True, capture_output=True, env=env,
                                cwd=path, shell=False, timeout=1800)
        if len(result.stdout.encode()) > 2_000_000:
            raise ValueError()
        value = json.loads(result.stdout)
        if result.returncode != 0 or value.get("ok") is not True:
            raise ValueError()
        return value
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "review_outcome_unknown", "retry": False}
    except (ValueError, TypeError, OSError):
        return {"ok": False, "error": "public_review_refused", "retry": False}


def register(ctx):
    ctx.register_tool(name="mithril_public_repo_review", toolset="mithril_public_review",
        handler=lambda args, **kwargs: json.dumps(invoke(ctx.get_config("system_one_root") or "", args)),
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="🔎",
        description="Review an exact public GitHub commit using Mithril policies",
        schema={"name": "mithril_public_repo_review", "description":
            "Read a public GitHub commit, parse bounded JavaScript ESM child_process calls and evaluate Mithril ontology. "
            "Always incomplete; source candidates require review. No target execution, LLM inference, GitHub writes or automatic remediation. Never retry unknown outcomes.",
            "parameters": {"type": "object", "properties": {
                "repository": {"type": "string", "pattern": "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"},
                "commit": {"type": "string", "pattern": "^[a-f0-9]{40}$"}},
                "required": ["repository", "commit"], "additionalProperties": False}})
