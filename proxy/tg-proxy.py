#!/usr/bin/env python3
"""Telegram Mini App proxy — SDK injection + /resume + /miniapp/ SPA.

Routes:
  /resume        → resume.html (session picker)
  /miniapp/*     → static files from ../app/ (Mini App SPA)
  everything else → proxy to hermes dashboard (UPSTREAM)
"""
import http.server, urllib.request, re, sys, socket, os, mimetypes

UPSTREAM = os.environ.get("TG_PROXY_UPSTREAM", "http://127.0.0.1:9119")
PORT = int(os.environ.get("TG_PROXY_PORT", "9118"))
BOT = os.environ.get("TG_PROXY_BOT", "evh055_bot")
DIR = os.path.dirname(os.path.realpath(__file__))
APP_DIR = os.path.join(os.path.dirname(DIR), "app")

TG_SCRIPT = ('<script src="https://telegram.org/js/telegram-web-app.js"></script>'
             '<script>try{Telegram.WebApp.ready();Telegram.WebApp.expand()}catch(e){}</script>')

# Load resume.html from disk
resume_path = os.path.join(DIR, "resume.html")
with open(resume_path) as f:
    RESUME_HTML = f.read()

# Inject TG bot name
RESUME_HTML = RESUME_HTML.replace("__BOT__", BOT)


def _serve_file(handler, filepath, content_type):
    """Send a local static file."""
    try:
        with open(filepath, "rb") as f:
            data = f.read()
        handler.send_response(200)
        handler.send_header("Content-Type", content_type)
        handler.send_header("Content-Length", str(len(data)))
        handler.send_header("Cache-Control", "public, max-age=300")
        handler.end_headers()
        handler.wfile.write(data)
    except FileNotFoundError:
        handler.send_error(404)


class H(http.server.BaseHTTPRequestHandler):
    def do(self):
        path = self.path.split("?")[0]

        if path in ("/resume", "/resume/"):
            body = RESUME_HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Serve Mini App SPA static files
        if path == "/miniapp" or path == "/miniapp/":
            _serve_file(self, os.path.join(APP_DIR, "index.html"), "text/html; charset=utf-8")
            return
        if path.startswith("/miniapp/"):
            rel = path[len("/miniapp/"):]
            filepath = os.path.join(APP_DIR, rel)
            # Security: ensure path stays within APP_DIR
            if not os.path.realpath(filepath).startswith(os.path.realpath(APP_DIR)):
                self.send_error(403)
                return
            ct, _ = mimetypes.guess_type(filepath)
            _serve_file(self, filepath, ct or "application/octet-stream")
            return

        try:
            body = None
            if self.command in ("POST", "PUT", "PATCH"):
                cl = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(cl) if cl > 0 else None

            req = urllib.request.Request(
                UPSTREAM + self.path,
                data=body,
                headers={k: v for k, v in self.headers.items()
                         if k.lower() not in ("host", "transfer-encoding", "content-encoding")},
                method=self.command
            )
            resp = urllib.request.urlopen(req, timeout=30)
            data = resp.read()
            ct = resp.headers.get("Content-Type", "")

            if "text/html" in ct and b"telegram-web-app.js" not in data:
                data = data.replace(b"</head>", TG_SCRIPT.encode() + b"</head>", 1)
                data = re.sub(rb"Content-Length: \d+",
                              b"Content-Length: " + str(len(data)).encode(),
                              data, count=1)

            self.send_response(resp.status)
            for k, v in resp.headers.items():
                if k.lower() in ("transfer-encoding", "content-encoding"):
                    continue
                if k.lower() == "content-length":
                    continue
                self.send_header(k, v)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_error(502, str(e))
            sys.stderr.write(f"[tg-proxy] {self.path}: {e}\n")
            sys.stderr.flush()

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = do_OPTIONS = do

    def log_message(self, *a):
        pass

if __name__ == "__main__":
    s = http.server.HTTPServer(("0.0.0.0", PORT), H)
    s.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sys.stderr.write(f"[tg-proxy] :{PORT} -> {UPSTREAM}\n")
    sys.stderr.flush()
    s.serve_forever()
