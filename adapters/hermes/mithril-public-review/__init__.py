"""Inert public source review; owning profile opt-in. No inference credentials."""
import json
import os
from pathlib import Path
import shutil
import subprocess


def invoke(root, args, entry="bin/mithril-public-review.mjs", keys={"repository", "commit"}):
    try:
        if not isinstance(args, dict) or set(args) != keys:
            raise ValueError()
        payload = json.dumps(args)
        if len(payload.encode()) > 2097152:
            raise ValueError()
        path = Path(root).expanduser().resolve(strict=True)
        if json.loads((path / "package.json").read_text()).get("name") != "@mithril/system-one":
            raise ValueError()
        node = shutil.which("node")
        # No profile/provider credentials enter either source parser or compiler.
        # Target files are data only: never shell, import, npm install or tests.
        env = {k: os.environ[k] for k in ("PATH", "HOME", "TMPDIR") if k in os.environ}
        result = subprocess.run([node, str(path / entry), "--stdin"],
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
        description="Review a public GitHub commit, locked npm dependencies and Mithril policies",
        schema={"name": "mithril_public_repo_review", "description":
            "Read a public GitHub commit, parse bounded JavaScript/TypeScript ESM/CommonJS child_process calls and evaluate Mithril ontology. "
            "Also reads npm package-lock v2/v3, queries OSV full records, calls the pinned local version matcher, and enriches CVE findings through knowledge.mithril.fund. Always incomplete; source/dependency candidates require review. No target execution, LLM inference, GitHub writes or automatic remediation. Never retry unknown outcomes.",
            "parameters": {"type": "object", "properties": {
                "repository": {"type": "string", "pattern": "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$"},
                "commit": {"type": "string", "pattern": "^[a-f0-9]{40}$"}},
                "required": ["repository", "commit"], "additionalProperties": False}})

    ctx.register_tool(name="mithril_scap_review", toolset="mithril_public_review",
        handler=lambda args, **kwargs: json.dumps(invoke(ctx.get_config("system_one_root") or "", args, "bin/mithril-scap.mjs", {"xml"})),
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="🔎",
        description="Import SCAP OVAL/XCCDF results into Mithril; no host scan",
        schema={"name":"mithril_scap_review","description":"Caller-supplied XML result import. No host probing, remote references or fixes. Unknown results retained.","parameters":{"type":"object","properties":{"xml":{"type":"string","maxLength":1048576}},"required":["xml"],"additionalProperties":False}})
    ctx.register_tool(name="mithril_dependency_upgrade", toolset="mithril_public_review",
        handler=lambda args, **kwargs: json.dumps(invoke(ctx.get_config("system_one_root") or "", args, "bin/mithril-upgrade.mjs", {"files"})),
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="🔧",
        description="Generate and reassess an isolated npm security upgrade patch",
        schema={"name":"mithril_dependency_upgrade","description":"Same-major direct npm upgrades, registry lock resolution with scripts disabled, OSV/Mithril recheck. Returns files only; no project writes, application tests or merge.","parameters":{"type":"object","properties":{"files":{"type":"array","minItems":2,"maxItems":2,"items":{"type":"object","properties":{"path":{"enum":["package.json","package-lock.json"]},"text":{"type":"string"},"sha256":{"type":"string","pattern":"^[a-f0-9]{64}$"}},"required":["path","text","sha256"],"additionalProperties":False}}},"required":["files"],"additionalProperties":False}})

    ctx.register_tool(name="mithril_business_process_review", toolset="mithril_public_review",
        handler=lambda args, **kwargs: json.dumps(invoke(ctx.get_config("system_one_root") or "", args, "bin/mithril-business-process.mjs", {"xml"})),
        check_fn=lambda: bool(ctx.get_config("system_one_root")), emoji="🔎",
        description="Evaluate supplied BPMN approval paths and declared business controls with Mithril",
        schema={"name":"mithril_business_process_review","description":"Bounded inert BPMN model review. All exclusive paths considered possible. No task execution, external data, IAM or audit-log attestation. Always operationally incomplete.","parameters":{"type":"object","properties":{"xml":{"type":"string","maxLength":1048576}},"required":["xml"],"additionalProperties":False}})
