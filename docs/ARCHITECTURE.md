---
title: Architecture
description: Huntarr cloud architecture on Cloudflare Pages, NeonDB, Clerk, OpenRouter BYOK, and Steel.dev BYOK.
---

# Architecture

## Target Architecture

```text
Browser (React + Clerk + Router)
  -> Pages Functions (Hono)
      -> NeonDB
  -> OpenRouter (BYOK, from browser)
  -> Steel.dev (BYOK, session calls proxied)
```

## Components

- **Frontend**: React + Vite + Tailwind in `src`
- **Auth**: Clerk in browser; token verified in Pages Functions
- **API**: Hono routes in `functions/api/[[route]].ts`
- **DB**: Neon PostgreSQL (`configs` table for user-scoped settings and credentials)
- **AI**: OpenRouter with user-provided API keys
- **Automation**: Steel.dev with user-provided API keys

## Routing

Frontend now uses URL routes instead of local view-only state:

- `/`
- `/jobs`
- `/jobs/:id`
- `/runs`
- `/runs/:id`
- `/applications/:id`
- `/manual`
- `/profile`
- `/settings`

## Security Model

- Clerk bearer token required on `/api/*` (except health)
- Token verified using Clerk JWKS and issuer
- User data scoped by user key prefixing in config keys
- BYOK credentials are stored per user

## Migration Status

- Cloudflare-ready frontend and function scaffold: done
- BYOK OpenRouter/Steel settings and tests: done
- Full cloud endpoint parity (runs/jobs/profile/etc.): in progress
