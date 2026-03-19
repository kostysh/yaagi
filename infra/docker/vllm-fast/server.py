from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os


PORT = int(os.environ.get("VLLM_FAST_PORT", "8000"))
MODEL_ID = os.environ.get("VLLM_FAST_MODEL_ID", "phase-0-fast")


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "model": MODEL_ID})
            return

        if self.path == "/v1/models":
            self._json(
                200,
                {
                    "object": "list",
                    "data": [
                        {
                            "id": MODEL_ID,
                            "object": "model",
                            "owned_by": "yaagi",
                        }
                    ],
                },
            )
            return

        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/v1/chat/completions":
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length > 0 else b"{}"
            request = json.loads(body.decode("utf-8"))
            messages = request.get("messages", [])
            content = ""
            if messages:
                last = messages[-1]
                if isinstance(last, dict):
                    content = f"phase-0 stub response for: {last.get('content', '')}"

            self._json(
                200,
                {
                    "id": "chatcmpl-phase0-stub",
                    "object": "chat.completion",
                    "created": 0,
                    "model": MODEL_ID,
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": content or "phase-0 stub response",
                            },
                            "finish_reason": "stop",
                        }
                    ],
                },
            )
            return

        self._json(404, {"error": "not found"})


server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
print(json.dumps({"level": "info", "message": "vllm-fast stub listening", "port": PORT}))
server.serve_forever()
