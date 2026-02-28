# huntarr

Automated job research & application agent — set it loose, let it hunt.

## Stack

- Frontend: React + Vite + Tailwind CSS (shadcn-style component primitives)
- API: FastAPI + PostgreSQL + SSE
- Worker: LangGraph + Playwright + Postgres queue (`FOR UPDATE SKIP LOCKED`)
- Infra: Docker Compose (local-first)
- Manual interventions: noVNC browser session (`playwright-vnc` service)

## Monorepo layout

- `apps/frontend`: React UI (dashboard/jobs/manual queue/profile/runs)
- `apps/api`: FastAPI backend + endpoints
- `apps/worker`: queue worker + LangGraph runtime
- `packages/core`: shared domain types, DB schema/repo, connectors, browser engine, graph
- `infra/docker/docker-compose.yml`: local deployment

## Quick start

1. Copy env template:

```bash
cp .env.example .env
```

2. Build and start:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

3. Open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- noVNC session: [http://localhost:7900](http://localhost:7900)

## Implemented API surface

- `POST /api/runs`
- `POST /api/runs/{id}/pause`
- `POST /api/runs/{id}/resume`
- `GET /api/runs`
- `GET /api/runs/{id}`
- `GET /api/runs/{id}/events` (SSE)
- `GET /api/jobs`
- `GET /api/jobs/{id}`
- `POST /api/jobs/{id}/apply-now`
- `GET /api/applications`
- `GET /api/manual-actions`
- `POST /api/manual-actions/{id}/start-session`
- `POST /api/manual-actions/{id}/resolve`
- `GET /api/profile`
- `PUT /api/profile`
- `POST /api/profile/resume-upload`
- `POST /api/profile/parse-resume`
- `GET /api/config`
- `PUT /api/config`
- `POST /api/credentials`
- `POST /api/schedules`
- `GET /api/schedules`

## Notes

- Platform login guardrail is enforced for LinkedIn/Indeed/Glassdoor authenticated apply flows.
- Company ATS account creation/login flows are allowed.
- CAPTCHA/challenge detection creates manual actions and pauses run execution for human intervention.
