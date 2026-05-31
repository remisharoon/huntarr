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

### Job Apply

- `POST /api/jobs/{id}/apply-now`

Behavior:

- Attempts ATS API auto-submit for supported portals (currently Lever and Greenhouse).
- If auto-submit is not possible, creates a live Steel session (requires `steel.dev` credential).
- Detects ATS provider from job URL when possible (Greenhouse, Lever, Workday, and others).
- Stores profile-derived autofill payload into application artifacts.
- Creates/updates a manual action for final submit confirmation.

Response shape:

```json
{
  "success": false,
  "application_id": "app_...",
  "status": "manual_required",
  "manual_action_id": "manual_...",
  "session_url": "https://app.steel.dev/...",
  "error_code": null
}
```

Possible `status` values:

- `submitted` (auto-submitted via ATS API, already submitted, or marked submitted after manual resolution)
- `manual_required` (live session created; operator confirmation required)
- `failed` (could not initialize automation pipeline)

### Manual Submission Confirmation

- `POST /api/manual-actions/{id}/resolve-submitted`

Body:

```json
{
  "confirmation_text": "Submitted in ATS portal",
  "submitted_at": "2026-05-31T18:02:11.000Z",
  "details": {
    "operator_note": "Verified thank-you page"
  }
}
```

Behavior:

- Resolves the manual action.
- Marks the linked application as `submitted`.
- Updates linked job status to `applied`.

## Notes

- This reference covers the currently implemented Pages Functions endpoints.
- Add additional routes in `functions/api/[[route]].ts` as needed.
