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
    "openrouter_model": "openai/gpt-4o-mini"
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

## Notes

- This reference covers the currently implemented Pages Functions endpoints.
- Add additional routes in `functions/api/[[route]].ts` as needed.
