"""Run one isolated official Terminal-Bench task, with an explicit request cap.

Requires Python 3.14, harbor==0.24.0 and Docker. The real Mithril key is used
only by the loopback relay and excluded from Harbor's process environment.
No owning Hermes profile, installed Desktop, or existing container is changed.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import threading
import urllib.request

from bench.mithril_relay import make_server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--attempts", type=int, default=1, help="Exactly one trial per owning request budget; use independent invocations for repeats")
    parser.add_argument("--max-api-calls", type=int, default=8)
    parser.add_argument("--max-turns", type=int, default=8)
    parser.add_argument("--port", type=int, default=18764)
    args = parser.parse_args()
    if args.attempts != 1 or not 0 < args.max_api_calls <= 24 or not 0 < args.max_turns <= 24:
        parser.error("invalid_limits")
    args.output.mkdir(parents=True, exist_ok=False)
    relay_token = secrets.token_urlsafe(32)
    server = make_server(args.port, args.max_api_calls, args.output / "inference-usage.jsonl", os.environ["MITHRIL_API_KEY"], relay_token)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    # Before any model call, verify loopback and container connectivity.
    with urllib.request.urlopen(f"http://127.0.0.1:{args.port}/health", timeout=5) as response:
        assert json.load(response)["calls"] == 0
    probe_code = f"fetch('http://host.docker.internal:{args.port}/health').then(async r=>{{if(!r.ok)process.exitCode=1;console.log(await r.text())}}).catch(()=>{{process.exitCode=1}})"
    probe = subprocess.run(["docker", "run", "--rm", "node:24-bookworm-slim", "node", "-e", probe_code], capture_output=True, text=True, timeout=120)
    if probe.returncode:
        (args.output / "preflight.json").write_text(json.dumps({"ok": False, "error": "container_relay_unreachable", "inference_calls": 0}, indent=2))
        raise SystemExit("container_relay_unreachable; no inference submitted")
    config = {
        "job_name": "mithril-terminal-smoke", "jobs_dir": str(args.output / "jobs"),
        "n_attempts": args.attempts, "n_concurrent_trials": 1,
        "retry": {"max_retries": 0}, "environment": {"type": "docker", "delete": True},
        "agents": [{"import_path": "bench.harbor_mithril:MithrilHermes", "model_name": "openai/qwen/qwen3.8-27b", "override_timeout_sec": 600,
                    "kwargs": {"max_turns": args.max_turns, "toolsets": "terminal,file"}}],
        "tasks": [{"path": str(args.task.resolve())}],
    }
    config_path = args.output / "config.json"
    config_path.write_text(json.dumps(config, indent=2))
    # Ordinary provider-name compatibility only; this token cannot access Mithril.
    # No actual API credential is present in config, container or agent environment.
    run_env = {k: v for k, v in os.environ.items() if k in {"PATH", "LANG", "LC_ALL", "TMPDIR", "DOCKER_HOST", "DOCKER_CONTEXT", "SSL_CERT_FILE"}}
    run_env.update(OPENAI_API_KEY=relay_token, OPENAI_BASE_URL=f"http://host.docker.internal:{args.port}/v1", PYTHONPATH=str(Path(__file__).resolve().parents[1]))
    result = subprocess.run([str(Path(sys.executable).with_name("harbor")), "run", "-c", str(config_path)], env=run_env)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
