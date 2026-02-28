.PHONY: up down logs test smoke

up:
	docker compose -f infra/docker/docker-compose.yml up --build

down:
	docker compose -f infra/docker/docker-compose.yml down

logs:
	docker compose -f infra/docker/docker-compose.yml logs -f

smoke:
	python3 -m compileall packages/core/src apps/api/src apps/worker/src

test:
	pytest -q
