from __future__ import annotations

import importlib.util
import os
import pathlib
import unittest

REPO = pathlib.Path(__file__).resolve().parents[1]
PROXY = REPO / "proxy" / "tg-proxy.py"


class ProxyStaticTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("TG_PROXY_BOT", "test_bot")
        spec = importlib.util.spec_from_file_location("tg_proxy", PROXY)
        assert spec and spec.loader
        cls.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.module)

    def test_resume_html_is_loaded_from_repo(self):
        self.assertIn("test_bot", self.module.RESUME_HTML)
        self.assertNotIn("__BOT__", self.module.RESUME_HTML)
        self.assertIn("Resume", self.module.RESUME_HTML)

    def test_telegram_sdk_snippet(self):
        self.assertIn("telegram-web-app.js", self.module.TG_SCRIPT)
        self.assertIn("Telegram.WebApp.ready", self.module.TG_SCRIPT)

    def test_static_app_is_versioned_in_repo(self):
        self.assertTrue((REPO / "app" / "index.html").exists())
        self.assertTrue((REPO / "app" / "js" / "app.js").exists())
        self.assertTrue((REPO / "app" / "css" / "layout.css").exists())


if __name__ == "__main__":
    unittest.main()
