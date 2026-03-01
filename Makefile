.PHONY: up down build logs test smoke

up:
	docker compose -f infra/docker/docker-compose.yml up

down:
	docker compose -f infra/docker/docker-compose.yml down

build:
	docker compose -f infra/docker/docker-compose.yml build

logs:
	docker compose -f infra/docker/docker-compose.yml logs -f

smoke:
	python3 -m compileall packages/core/src apps/api/src apps/worker/src

test:
	pytest -q
