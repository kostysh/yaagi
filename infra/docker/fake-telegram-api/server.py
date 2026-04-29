from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

UPDATES: list[dict] = []
SENT_MESSAGES: list[dict] = []
NEXT_SEND_FAILURE: dict | None = None


def make_update(payload: dict) -> dict:
    if "update_id" in payload and "message" in payload:
        return payload

    chat_id = int(payload.get("chat_id", 12345))
    update_id = int(payload.get("update_id", len(UPDATES) + 1))
    message_id = int(payload.get("message_id", update_id * 10))
    text = str(payload.get("text", "telegram smoke"))
    date = int(payload.get("date", 1773590400))
    return {
        "update_id": update_id,
        "message": {
            "message_id": message_id,
            "date": date,
            "text": text,
            "chat": {
                "id": chat_id,
                "type": payload.get("chat_type", "private"),
            },
            "from": {
                "id": int(payload.get("from_id", 100)),
                "username": payload.get("from_username", "operator"),
            },
        },
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "fake-telegram-api/1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, {"ok": True})
            return

        if parsed.path.endswith("/getUpdates"):
            params = parse_qs(parsed.query)
            offset = int(params.get("offset", ["0"])[0])
            updates = [update for update in UPDATES if int(update["update_id"]) >= offset]
            self._send_json(200, {"ok": True, "result": updates})
            return

        if parsed.path == "/__test__/sentMessages":
            self._send_json(200, {"ok": True, "result": SENT_MESSAGES})
            return

        self._send_json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        global NEXT_SEND_FAILURE
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        payload = json.loads(body.decode("utf-8"))

        if parsed.path == "/__test__/updates":
            update = make_update(payload)
            UPDATES.append(update)
            self._send_json(202, {"ok": True, "queued": update["update_id"]})
            return

        if parsed.path == "/__test__/sendFailure":
            NEXT_SEND_FAILURE = payload
            self._send_json(202, {"ok": True, "armed": True})
            return

        if parsed.path.endswith("/getUpdates"):
            offset = int(parse_qs(parsed.query).get("offset", ["0"])[0])
            updates = [update for update in UPDATES if int(update["update_id"]) >= offset]
            self._send_json(200, {"ok": True, "result": updates})
            return

        if parsed.path.endswith("/sendMessage"):
            if NEXT_SEND_FAILURE is not None:
                failure = NEXT_SEND_FAILURE
                NEXT_SEND_FAILURE = None
                self._send_json(
                    int(failure.get("status", 500)),
                    {
                        "ok": False,
                        "error_code": int(failure.get("error_code", 500)),
                        "description": failure.get("description", "forced sendMessage failure"),
                        **(
                            {"parameters": {"retry_after": int(failure["retry_after"])}}
                            if "retry_after" in failure
                            else {}
                        ),
                    },
                )
                return

            chat_id = str(payload.get("chat_id", ""))
            text = str(payload.get("text", ""))
            message_id = len(SENT_MESSAGES) + 1000
            sent_message = {
                "message_id": message_id,
                "chat": {"id": chat_id, "type": "private"},
                "date": 1773590400 + len(SENT_MESSAGES),
                "text": text,
            }
            SENT_MESSAGES.append(
                {
                    "method": "sendMessage",
                    "chat_id": chat_id,
                    "text": text,
                    "message_id": message_id,
                }
            )
            self._send_json(200, {"ok": True, "result": sent_message})
            return

        self._send_json(404, {"ok": False, "error": "not_found"})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/__test__/updates":
            UPDATES.clear()
            self._send_json(200, {"ok": True, "cleared": True})
            return

        if parsed.path == "/__test__/sentMessages":
            SENT_MESSAGES.clear()
            self._send_json(200, {"ok": True, "cleared": True})
            return

        if parsed.path == "/__test__/state":
            global NEXT_SEND_FAILURE
            UPDATES.clear()
            SENT_MESSAGES.clear()
            NEXT_SEND_FAILURE = None
            self._send_json(200, {"ok": True, "cleared": True})
            return

        self._send_json(404, {"ok": False, "error": "not_found"})

    def log_message(self, format: str, *args) -> None:
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8081), Handler)
    server.serve_forever()
