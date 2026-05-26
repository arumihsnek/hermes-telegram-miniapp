from pathlib import Path


def test_watchdog_targets_repo_proxy() -> None:
    text = Path("scripts/tg-proxy-watch.py").read_text(encoding="utf-8")
    assert "REPO / \"proxy\" / \"tg-proxy.py\"" in text
    assert "~/.hermes/scripts/tg-proxy.py" not in text
    assert "TG_PROXY_SCRIPT" in text
