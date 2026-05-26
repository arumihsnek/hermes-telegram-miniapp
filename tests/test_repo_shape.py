from pathlib import Path


REPO = Path(__file__).resolve().parents[1]


def test_only_one_canonical_healthcheck_script_exists() -> None:
    scripts = sorted((REPO / "scripts").glob("*healthcheck.py"))
    assert [p.name for p in scripts] == ["healthcheck.py"]


def test_static_app_does_not_ship_python_ops_scripts() -> None:
    assert not (REPO / "app" / "scripts" / "healthcheck.py").exists()


def test_repo_has_expected_top_level_operational_dirs() -> None:
    for rel in ("app", "proxy", "scripts", "ops", "docs", "tests"):
        assert (REPO / rel).exists(), rel
