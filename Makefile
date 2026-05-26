.PHONY: test smoke healthcheck status deploy lint

PYTHON ?= python3

status:
	git status --short
	systemctl is-active tg-proxy.service || true

lint:
	$(PYTHON) -m py_compile proxy/tg-proxy.py scripts/healthcheck.py scripts/tg-proxy-watch.py
	test -f app/index.html
	test -f proxy/resume.html

test: lint
	$(PYTHON) -m unittest discover -s tests -v

smoke:
	bash scripts/smoke.sh

healthcheck:
	$(PYTHON) scripts/healthcheck.py

deploy: test
	sudo bash scripts/deploy-host.sh
