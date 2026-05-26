# Hermes Telegram Mini App Rebuild Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Convert the current miniapp repo from an operational proxy snapshot into a real maintainable product repo with source-of-truth docs, tooling, tests, deploy flow, and a clear roadmap for `/resume <id>` and future Telegram-native UX.

**Architecture:** Keep the current production path working (`OpenResty -> tg-proxy -> WebUI`) while cleaning the repo so it accurately reflects reality. First stabilize the repo itself (docs, config, scripts, tests, deploy). Then extend the product surface (`/resume`, health, deep links, Telegram integration) without touching native WebUI files.

**Tech Stack:** Python 3, static HTML/JS, systemd, OpenResty/nginx, Telegram WebApp SDK, Hermes Gateway, pytest.

---

## Current diagnosis

### What the repo is today
- Tiny operational repo: 7 real source/doc files, ~232 LOC.
- Main value is `proxy/tg-proxy.py` + `proxy/resume.html`.
- Repo does **not** contain the SPA/kanban/tasks app described in `README.md`.
- Docs are inconsistent with reality:
  - README talks about `/opt/data/miniapp/`, port `9444`, `miniapp_handler.py`, SPA assets, and routes that are **not in this repo**.
  - Current architecture doc describes the newer `:9118 -> :9119` proxy setup.
- `scripts/tg-proxy-watch.py` still points to `~/.hermes/scripts/tg-proxy.py` instead of the repo path.
- `scripts/healthcheck.py` and `scripts/miniapp-healthcheck.py` are duplicates.
- No tests, no deploy script, no systemd unit template, no env example, no smoke test, no lint/format config.

### Product risks
- Source of truth is unclear.
- New contributors will follow stale docs and break prod.
- Operational knowledge lives in chat/history instead of the repo.
- `/resume <id>` backend path is not tracked from this repo.

---

## Phase 1 — Make the repo truthful

### Task 1: Replace misleading README with current-scope README

**Objective:** Make `README.md` describe the repo that actually exists today.

**Files:**
- Modify: `README.md`
- Reference: `docs/telegram-miniapp-architecture.md`

**Step 1: Write failing review checklist**

Create a temporary checklist in your notes:
- README must mention current repo path `/opt/data/hermes/miniapp/`
- README must mention current prod path `OpenResty :443 -> tg-proxy :9118 -> WebUI :9119`
- README must stop claiming SPA/kanban source exists here unless it really does
- README must document `/resume`

**Step 2: Review current README**

Run: `sed -n '1,220p' /opt/data/hermes/miniapp/README.md`
Expected: stale references to `/opt/data/miniapp/`, `:9444`, SPA folders that are absent.

**Step 3: Replace README with minimal truthful version**

New README should contain:
- What this repo is
- Current production architecture
- Repo tree that actually exists
- Local verification commands
- Deploy/update instructions
- Known gaps (`/resume <id>` not yet implemented in gateway)

**Step 4: Verify README no longer references missing files**

Run: `grep -nE '9444|miniapp_handler|js/|css/|dashboard/' /opt/data/hermes/miniapp/README.md`
Expected: either no matches or only explicit “future work” mentions.

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: make miniapp README match reality"
```

### Task 2: Add explicit repo status document

**Objective:** Capture what is real, what is stale, and what is future work.

**Files:**
- Create: `docs/repo-status.md`

**Step 1: Write the document**

Sections:
- In production now
- In repo now
- Not in repo yet
- Deprecated assumptions
- Next milestones

**Step 2: Verify document helps a new contributor**

Check that someone can answer:
- What is deployed?
- What is source of truth?
- What is missing?
- What should not be modified?

**Step 3: Commit**

```bash
git add docs/repo-status.md
git commit -m "docs: add repo status and scope"
```

### Task 3: Fix the watchdog path bug

**Objective:** Make the watchdog launch the repo-managed proxy, not an old ad-hoc script path.

**Files:**
- Modify: `scripts/tg-proxy-watch.py`
- Test: `tests/test_watchdog_config.py`

**Step 1: Write failing test**

```python
from pathlib import Path
import importlib.util


def test_watchdog_targets_repo_proxy():
    path = Path("scripts/tg-proxy-watch.py")
    text = path.read_text()
    assert "/opt/data/hermes/miniapp/proxy/tg-proxy.py" in text
    assert "~/.hermes/scripts/tg-proxy.py" not in text
```

**Step 2: Run test to verify failure**

Run: `pytest tests/test_watchdog_config.py -v`
Expected: FAIL because old path is still present.

**Step 3: Minimal implementation**

Update constants in `scripts/tg-proxy-watch.py`:

```python
SCRIPT = "/opt/data/hermes/miniapp/proxy/tg-proxy.py"
PYTHON = "/usr/bin/python3"
LOG = "/opt/data/hermes/miniapp/tg-proxy-watch.log"
```

**Step 4: Re-run test**

Run: `pytest tests/test_watchdog_config.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/tg-proxy-watch.py tests/test_watchdog_config.py
git commit -m "fix: point watchdog to repo-managed proxy"
```

### Task 4: Remove duplicate healthcheck script

**Objective:** Leave one canonical healthcheck file.

**Files:**
- Modify: `README.md`
- Delete: `scripts/healthcheck.py` or `scripts/miniapp-healthcheck.py`
- Create: `tests/test_repo_shape.py`

**Step 1: Write failing test**

```python
from pathlib import Path

def test_only_one_healthcheck_script_exists():
    scripts = sorted(Path("scripts").glob("*healthcheck.py"))
    assert len(scripts) == 1, [str(p) for p in scripts]
```

**Step 2: Run test to verify failure**

Run: `pytest tests/test_repo_shape.py::test_only_one_healthcheck_script_exists -v`
Expected: FAIL because there are two files.

**Step 3: Keep one file and update docs**

Prefer `scripts/miniapp-healthcheck.py` as canonical, or rename to `scripts/healthcheck.py` and update references consistently.

**Step 4: Re-run test**

Run: `pytest tests/test_repo_shape.py::test_only_one_healthcheck_script_exists -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts README.md tests/test_repo_shape.py
git commit -m "refactor: keep one canonical healthcheck script"
```

---

## Phase 2 — Add project utilities this repo should have

### Task 5: Add environment template

**Objective:** Make runtime knobs explicit instead of hardcoded tribal knowledge.

**Files:**
- Create: `.env.example`
- Modify: `proxy/tg-proxy.py`
- Test: `tests/test_proxy_env.py`

**Step 1: Write failing test**

```python
from pathlib import Path

def test_env_example_lists_required_proxy_vars():
    text = Path('.env.example').read_text()
    for key in ['TG_PROXY_UPSTREAM=', 'TG_PROXY_PORT=', 'TG_PROXY_BOT=']:
        assert key in text
```

**Step 2: Run test to verify failure**

Run: `pytest tests/test_proxy_env.py -v`
Expected: FAIL because `.env.example` does not exist.

**Step 3: Create `.env.example`**

Example content:

```dotenv
TG_PROXY_UPSTREAM=http://127.0.0.1:9119
TG_PROXY_PORT=9118
TG_PROXY_BOT=evh055_bot
```

**Step 4: Verify proxy already honors env vars**

Run: `grep -n 'TG_PROXY_' proxy/tg-proxy.py`
Expected: three env-backed settings found.

**Step 5: Commit**

```bash
git add .env.example proxy/tg-proxy.py tests/test_proxy_env.py
git commit -m "chore: add env template for proxy config"
```

### Task 6: Add pytest scaffolding

**Objective:** Give the repo a minimal automated test harness.

**Files:**
- Create: `pyproject.toml`
- Create: `tests/conftest.py`
- Create: `tests/test_proxy_smoke.py`

**Step 1: Write minimal pytest config**

`pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
```

**Step 2: Add proxy smoke test**

```python
from pathlib import Path

def test_proxy_file_exists():
    assert Path("proxy/tg-proxy.py").exists()


def test_resume_html_contains_telegram_sdk():
    text = Path("proxy/resume.html").read_text()
    assert "telegram-web-app.js" in text
```

**Step 3: Run tests**

Run: `pytest -v`
Expected: PASS once scaffolding exists.

**Step 4: Commit**

```bash
git add pyproject.toml tests/
git commit -m "test: add minimal pytest harness"
```

### Task 7: Add deploy script

**Objective:** Stop relying on manual chat instructions for deployment.

**Files:**
- Create: `scripts/deploy-host.sh`
- Modify: `README.md`

**Step 1: Write deploy script**

Script responsibilities:
- Validate repo path
- Optionally run tests
- Sync repo to host target path or validate host repo state
- Restart `tg-proxy.service`
- Probe `http://127.0.0.1:9118/resume`

**Step 2: Dry-run verify script syntax**

Run: `bash -n scripts/deploy-host.sh`
Expected: no output.

**Step 3: Document usage**

Add exact usage examples in README.

**Step 4: Commit**

```bash
git add scripts/deploy-host.sh README.md
git commit -m "ops: add host deploy script"
```

### Task 8: Add systemd unit template

**Objective:** Store the service definition in the repo.

**Files:**
- Create: `ops/tg-proxy.service`
- Modify: `README.md`

**Step 1: Write the unit file**

Use the currently working service shape:
- `ExecStart=/usr/bin/python3 /opt/data/hermes/miniapp/proxy/tg-proxy.py`
- `WorkingDirectory=/opt/data/hermes/miniapp/proxy`
- `Restart=always`
- `User=ubuntu`

**Step 2: Verify content**

Run: `grep -nE 'ExecStart|WorkingDirectory|Restart=always|User=' ops/tg-proxy.service`
Expected: all fields present.

**Step 3: Commit**

```bash
git add ops/tg-proxy.service README.md
git commit -m "ops: add systemd unit template"
```

---

## Phase 3 — Add operational verification utilities

### Task 9: Add smoke test script for the live stack

**Objective:** One command should tell us whether prod is healthy.

**Files:**
- Create: `scripts/smoke.sh`
- Modify: `README.md`

**Step 1: Script checks**
- `curl -fsS https://webui.hermesinthenight.duckdns.org/ | grep telegram-web-app.js`
- `curl -fsS https://webui.hermesinthenight.duckdns.org/resume | grep 'Conversaciones'`
- optional: `systemctl is-active tg-proxy`

**Step 2: Verify syntax**

Run: `bash -n scripts/smoke.sh`
Expected: no output.

**Step 3: Commit**

```bash
git add scripts/smoke.sh README.md
git commit -m "ops: add production smoke test"
```

### Task 10: Add changelog

**Objective:** Stop losing intent between commits and chat history.

**Files:**
- Create: `CHANGELOG.md`

**Step 1: Seed changelog**

Include sections:
- Added
- Fixed
- Changed
- Known gaps

**Step 2: Backfill initial items**
- Proxy-based Telegram SDK injection
- `/resume` page
- Host systemd deployment
- `/resume <id>` backend still missing

**Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add changelog"
```

---

## Phase 4 — Product roadmap work

### Task 11: Define `/resume <id>` contract in this repo

**Objective:** Even if implementation lives in Hermes gateway, this repo must define expected behavior.

**Files:**
- Create: `docs/resume-command-spec.md`

**Step 1: Write spec**

Include:
- accepted forms: `/resume abc123`, `/resume full-session-id`
- lookup behavior: prefix match, ambiguity handling, not-found handling
- response behavior in Telegram
- whether it opens Mini App or restores chat context directly
- security constraints

**Step 2: Verify the spec answers edge cases**
- multiple matching prefixes
- expired/missing session
- unauthorized user
- scheduled session vs chat session

**Step 3: Commit**

```bash
git add docs/resume-command-spec.md
git commit -m "docs: specify telegram resume command behavior"
```

### Task 12: Add gateway integration tracking doc

**Objective:** Track the external dependency on `/opt/hermes/gateway/platforms/telegram.py`.

**Files:**
- Create: `docs/gateway-integration.md`

**Step 1: Write doc**

Sections:
- external code location
- expected hook point for `/resume`
- data dependencies (`state.db`, sessions API)
- test matrix for bot behavior

**Step 2: Commit**

```bash
git add docs/gateway-integration.md
git commit -m "docs: track gateway integration points"
```

---

## Utilities this project should have

### Must-have immediately
- Truthful `README.md`
- `repo-status.md`
- canonical healthcheck
- working watchdog path
- `pyproject.toml` + `pytest`
- `.env.example`
- `scripts/deploy-host.sh`
- `scripts/smoke.sh`
- `ops/tg-proxy.service`
- `CHANGELOG.md`

### Should-have next
- `Makefile` or `justfile`
- pre-commit config
- CI workflow (lint + tests)
- structured JSON logging for proxy
- release/version file
- issue templates / contribution guide

### Product features after tooling
- `/resume <id>` implemented in gateway
- deep links to exact session
- Telegram-user-aware auth
- completion notifications
- migration path away from HTML-scraped session token

---

## Recommended execution order

1. Make docs truthful
2. Fix watchdog + dedupe scripts
3. Add tests/config/env
4. Add deploy/smoke/systemd templates
5. Write `/resume` spec
6. Only then implement gateway-side `/resume <id>`

---

## Verification commands

```bash
cd /opt/data/hermes/miniapp
pytest -v
bash -n scripts/deploy-host.sh
bash -n scripts/smoke.sh
python3 proxy/tg-proxy.py  # local manual test if needed
curl -s https://webui.hermesinthenight.duckdns.org/ | grep -c 'telegram-web-app.js'
curl -s https://webui.hermesinthenight.duckdns.org/resume | head -5
```

Expected outcomes:
- tests pass
- shell scripts are syntactically valid
- SDK is injected on main page
- `/resume` returns HTML successfully

---

## Final recommendation

Do **not** treat this repo as “the miniapp product” yet. Right now it is a **production rescue repo** for the proxy layer. The first project goal should be to make it a reliable operational package. Once that is done, implement `/resume <id>` and then decide whether the real future is:

1. keep this proxy repo as a small ops-sidecar, or
2. grow it into the full Telegram miniapp product repo, or
3. replace it with a Hermes plugin.
