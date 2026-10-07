import io
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

from bench.mithril_relay import Budget, MODEL, make_server


class UpstreamResponse(io.BytesIO):
    status = 200
    headers = {"x-mithril-request-id": "owned-request"}


class Opener:
    def __init__(self, failure=False):
        self.requests = []
        self.failure = failure

    def open(self, request, timeout):
        self.requests.append(request)
        if self.failure:
            raise urllib.error.HTTPError(request.full_url, 503, "upstream", {}, io.BytesIO(b"sensitive upstream details"))
        return UpstreamResponse(json.dumps({"id": "owned-completion", "model": MODEL, "usage": {"prompt_tokens": 5, "completion_tokens": 2}, "choices": [{"message": {"role": "assistant", "content": "done"}, "finish_reason": "stop"}]}).encode())


class RelayTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.log = Path(self.directory.name) / "usage.jsonl"
        self.opener = Opener()
        self.server = make_server(0, 1, self.log, "owning-test-secret", "isolated-relay-token", self.opener)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/v1/chat/completions"

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.directory.cleanup()

    def request(self, token="isolated-relay-token", **extra):
        body = {"model": MODEL, "messages": [{"role": "user", "content": "public task"}], "stream": False, **extra}
        request = urllib.request.Request(self.url, data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + token})
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, response.read().decode()
        except urllib.error.HTTPError as error:
            return error.code, error.read().decode()

    def test_unauthorized_and_wrong_model_do_not_consume_budget(self):
        self.assertEqual(self.request(token="wrong")[0], 403)
        self.assertEqual(self.request(model="different")[0], 400)
        self.assertEqual(self.opener.requests, [])
        self.assertEqual(self.request()[0], 200)

    def test_secret_stays_upstream_usage_is_metered_and_limit_prevents_extra_call(self):
        status, body = self.request(max_tokens=10000)
        self.assertEqual(status, 200)
        self.assertNotIn("owning-test-secret", body)
        upstream = self.opener.requests[0]
        self.assertEqual(upstream.get_header("Authorization"), "Bearer owning-test-secret")
        self.assertEqual(json.loads(upstream.data)["max_completion_tokens"], 4096)
        self.assertEqual(self.request()[0], 429)
        self.assertEqual(len(self.opener.requests), 1)
        text = self.log.read_text()
        self.assertNotIn("owning-test-secret", text)
        self.assertNotIn("public task", text)
        self.assertEqual(json.loads(text)["usage"]["completion_tokens"], 2)

    def test_unknown_upstream_stops_without_retry_or_sensitive_error_body(self):
        self.opener.failure = True
        status, body = self.request()
        self.assertEqual(status, 503)
        self.assertNotIn("sensitive upstream", body)
        self.assertEqual(self.request()[0], 429)
        self.assertEqual(len(self.opener.requests), 1)

    def test_budget_is_atomic_across_competing_clients(self):
        budget = Budget(3)
        values = []
        clients = [threading.Thread(target=lambda: values.append(budget.reserve())) for _ in range(12)]
        for client in clients:
            client.start()
        for client in clients:
            client.join()
        self.assertEqual(sum(bool(value) for value in values), 3)
        self.assertEqual(sorted(value for value in values if value), [1, 2, 3])

    def test_streamed_tool_result_is_forwarded_unchanged_and_usage_is_metered(self):
        chunk = {"id": "streamed-completion", "model": MODEL, "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0, "id": "tool1", "type": "function", "function": {"name": "terminal", "arguments": "{}"}}]}, "finish_reason": "tool_calls"}], "usage": {"prompt_tokens": 20, "completion_tokens": 8}}
        payload = ("data: " + json.dumps(chunk) + "\n\ndata: [DONE]\n\n").encode()
        response = UpstreamResponse(payload)
        response.headers = {"Content-Type": "text/event-stream", "x-mithril-request-id": "streamed-request"}
        self.opener.open = lambda *args, **kwargs: response
        status, body = self.request(stream=True)
        self.assertEqual(status, 200)
        self.assertEqual(body.encode(), payload)
        self.assertEqual(json.loads(self.log.read_text())["usage"]["completion_tokens"], 8)

    def test_incomplete_stream_stops_future_submissions(self):
        response = UpstreamResponse(b'data: {"model":"qwen/qwen3.8-27b","choices":[]}\n\n')
        response.headers = {"Content-Type": "text/event-stream"}
        self.opener.open = lambda *args, **kwargs: response
        self.request(stream=True)
        self.assertEqual(self.request()[0], 429)
        self.assertEqual(json.loads(self.log.read_text())["error"], "outcome_unknown")


if __name__ == "__main__":
    unittest.main()
