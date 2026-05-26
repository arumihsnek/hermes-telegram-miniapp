from pathlib import Path


def test_env_example_lists_required_runtime_vars() -> None:
    text = Path('.env.example').read_text(encoding='utf-8')
    for key in [
        'TG_PROXY_UPSTREAM=',
        'TG_PROXY_PORT=',
        'TG_PROXY_BOT=',
        'MINIAPP_PUBLIC_URL=',
    ]:
        assert key in text
