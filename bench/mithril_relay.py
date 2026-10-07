"""Loopback-only, bounded inference relay for isolated Harbor trials.

The real Mithril credential stays in this process, outside the task container.
No headers, prompts, response contents or credential values are logged. A 5xx,
transport failure or unreadable result stops subsequent upstream submissions.
"""
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

API = "https://api.mithril.fund/v1/chat/completions"
MODEL = "qwen/qwen3.8-27b"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Budget:
    def __init__(self, limit):
        self.limit = limit
        self.calls = 0
        self.stopped = False
        self.lock = threading.Lock()

    def reserve(self):
        with self.lock:
            if self.stopped or self.calls >= self.limit:
                return False
            self.calls += 1
            return self.calls


def make_server(port, limit, log_path, token, relay_token, opener=None):
    if not 0 < limit <= 36:
        raise ValueError("invalid_limit")
    budget = Budget(limit)
    opener = opener or urllib.request.build_opener(NoRedirect)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, status, value):
            data = json.dumps(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/health":
                self.reply(200, {"ok": True, "calls": budget.calls, "stopped": budget.stopped})
            elif self.path == "/v1/models":
                self.reply(200, {"object": "list", "data": [{"id": MODEL, "object": "model"}]})
            else:
                self.reply(404, {"error": "unsupported_route"})

        def do_POST(self):
            if self.path != "/v1/chat/completions":
                self.reply(404, {"error": "unsupported_route"})
                return
            if self.headers.get("Authorization") != "Bearer " + relay_token:
                self.reply(403, {"error": "relay_authorization_refused"})
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 524288:
                    raise ValueError()
                body = json.loads(self.rfile.read(size))
                if body.get("model") != MODEL or not isinstance(body.get("messages"), list):
                    raise ValueError()
                streamed = bool(body.get("stream"))
                body["stream"] = streamed
                if streamed:
                    body["stream_options"] = {"include_usage": True}
                else:
                    body.pop("stream_options", None)
                body["max_completion_tokens"] = min(int(body.pop("max_tokens", body.get("max_completion_tokens", 4096))), 4096)
                if body["max_completion_tokens"] < 1:
                    raise ValueError()
                body["temperature"] = 0
                call_number = budget.reserve()
                if not call_number:
                    self.reply(429, {"error": "benchmark_budget_or_unknown_outcome_stop"})
                    return
            except (ValueError, TypeError, json.JSONDecodeError):
                self.reply(400, {"error": "invalid_request"})
                return
            started = time.monotonic()
            row = {"call": call_number, "model": MODEL, "billed_cost_usd": None}
            headers_sent = False
            try:
                request = urllib.request.Request(API, data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", "Origin": "https://code.mithril.fund", "User-Agent": "Mithril-System-One-Benchmark/0.1"})
                with opener.open(request, timeout=90) as response:
                    row.update(status=response.status, request_id=response.headers.get("x-mithril-request-id"))
                    if streamed:
                        if "text/event-stream" not in response.headers.get("Content-Type", ""):
                            raise ValueError()
                        self.send_response(200)
                        self.send_header("Content-Type", "text/event-stream")
                        self.send_header("Connection", "close")
                        self.end_headers()
                        headers_sent = True
                        total_bytes = 0
                        done = False
                        for line in response:
                            total_bytes += len(line)
                            if total_bytes > 8388608:
                                raise ValueError()
                            if line.startswith(b"data:"):
                                data = line[5:].strip()
                                if data == b"[DONE]":
                                    done = True
                                elif data:
                                    chunk = json.loads(data)
                                    if chunk.get("error") or chunk.get("model", MODEL) != MODEL:
                                        raise ValueError()
                                    if chunk.get("usage") is not None:
                                        row["usage"] = chunk["usage"]
                                    if chunk.get("id"):
                                        row["completion_id"] = chunk["id"]
                            self.wfile.write(line)
                            self.wfile.flush()
                        if not done:
                            raise ValueError()
                        self.close_connection = True
                        return
                    raw = response.read(1048577)
                    if len(raw) > 1048576:
                        raise ValueError()
                    value = json.loads(raw)
                    row.update(status=response.status, usage=value.get("usage"), request_id=response.headers.get("x-mithril-request-id"), completion_id=value.get("id"))
                    if value.get("model") != MODEL or len(value.get("choices", [])) != 1:
                        raise ValueError()
                self.reply(200, value)
            except urllib.error.HTTPError as error:
                row.update(status=error.code, error="upstream_http_refused")
                try:
                    detail=json.loads(error.read(8192))
                    code=detail.get("error")
                    if isinstance(code,dict):
                        code=code.get("code")
                    if isinstance(code,str) and re.fullmatch(r"[a-z][a-z0-9_]{1,63}",code):
                        row["upstream_error_code"]=code
                except (ValueError,TypeError,AttributeError):
                    pass
                # No upstream error body or headers leave the relay.
                budget.stopped = True
                self.reply(error.code if error.code >= 400 else 502, {"error": "upstream_http_refused"})
            except Exception:
                row.update(error="outcome_unknown")
                budget.stopped = True
                if not headers_sent:
                    self.reply(502, {"error": "outcome_unknown_no_retry"})
                else:
                    self.close_connection = True
            finally:
                row["seconds"] = time.monotonic() - started
                with budget.lock:
                    with Path(log_path).open("a") as out:
                        out.write(json.dumps(row) + "\n")

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def serve(port, limit, log_path):
    server = make_server(port, limit, log_path, os.environ["MITHRIL_API_KEY"], os.environ["MITHRIL_BENCH_RELAY_TOKEN"])
    print(json.dumps({"ready": True, "port": port, "max_upstream_calls": limit}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18764)
    parser.add_argument("--max-api-calls", type=int, default=24)
    parser.add_argument("--log", required=True)
    args = parser.parse_args()
    serve(args.port, args.max_api_calls, args.log)
