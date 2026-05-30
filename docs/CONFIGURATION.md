---
title: Configuration
description: Environment and runtime configuration for Huntarr Cloudflare Pages deployment.
---

# Configuration

## Frontend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for browser auth |
| `VITE_API_BASE` | No | API base override; leave empty for same-origin |

Example:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE=
```

## Cloudflare Pages Variables

| Variable | Required | Description |
|---|---|---|
| `CLERK_JWKS_URL` | Yes | Clerk JWKS endpoint for token verification |
| `CLERK_ISSUER` | Yes | Clerk token issuer |

## Cloudflare Pages Secrets

| Secret | Required | Description |
|---|---|---|
| `NEON_DATABASE_URL` | Yes | Neon Postgres connection string |

## BYOK Policy

Huntarr uses user-owned keys:

- OpenRouter key (AI)
- Steel.dev key (browser automation)

Keys are configured from Settings and stored per-user via API.

## Data Storage

The app stores user-scoped config and credentials in the `configs` table using key prefixes.

## Files

- `.env.example`
- `wrangler.toml`
- `CLOUDFLARE_SETUP.md`
