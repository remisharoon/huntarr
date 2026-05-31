---
title: API Reference
description: Cloudflare Pages Functions API reference for Huntarr.
---

# API Reference

Base URL (local):

```text
http://localhost:5173
```

Base URL (prod):

```text
https://<your-pages-domain>
```

All endpoints are under `/api`.

## Authentication

- Bearer token from Clerk is required for all `/api/*` routes except `/api/health`.

## Endpoints (Implemented)

### Health

- `GET /api/health`
- Response:

```json
{
  "status": "ok",
  "database_time": "..."
}
```

### Config

- `GET /api/config?key=default`
- `PUT /api/config?key=default`

`PUT` body:

```json
{
  "value": {
    "openrouter_model": "openrouter/free"
  }
}
```

### Credentials

- `GET /api/credentials`
- `GET /api/credentials/{domain}/{username}`
- `POST /api/credentials`
- `DELETE /api/credentials/{domain}/{username}`

`POST` body:

```json
{
  "domain": "openrouter.ai",
  "username": "default",
  "password": "<api-key>",
  "metadata": {
    "provider": "openrouter",
    "byok": true
  }
}
```

### BYOK Steel Session

- `POST /api/byok/steel/session`

Body:

```json
{
  "api_key": "<steel-key>",
  "project_id": "optional",
  "metadata": {
    "source": "huntarr-settings-test"
  }
}
```

Response:

```json
{
  "ok": true,
  "message": "Steel key test succeeded",
  "session": {}
}
```

### Runs

- `POST /api/runs`

`POST` body (example):

```json
{
  "mode": "manual",
  "search_config": {
    "role_keywords": ["Software Engineer"],
    "locations": ["Remote"],
    "sources": ["remoteok", "remotive", "themuse"],
    "max_jobs_per_run": 80
  }
}
```

Supported source IDs:

- `remoteok`
- `weworkremotely`
- `remotive`
- `themuse`
- `arbeitnow`
- `brave_search` (placeholder; unavailable in this cloud build)
- `adzuna` (requires credential metadata `app_id`)
- `usajobs` (requires credential metadata `user_agent`)

Run events include per-source fetch, warning, and failure details.

## Notes

- This reference covers the currently implemented Pages Functions endpoints.
- Add additional routes in `functions/api/[[route]].ts` as needed.
