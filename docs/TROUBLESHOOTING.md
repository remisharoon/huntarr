---
title: Troubleshooting
description: Common issues for Huntarr Cloudflare Pages deployment.
---

# Troubleshooting

## Clerk Login Redirect Loop

Symptoms:
- You keep getting redirected to `/sign-in`.

Checks:
- `VITE_CLERK_PUBLISHABLE_KEY` is set.
- Clerk app has allowed origins configured for your local/prod domain.
- Browser has no blocked third-party cookie policy breaking Clerk session.

## API 401 Unauthorized

Symptoms:
- `/api/*` calls fail with 401.

Checks:
- Frontend is sending `Authorization: Bearer <token>`.
- `CLERK_JWKS_URL` and `CLERK_ISSUER` are set in Pages Functions.

## API 500 Missing Neon Binding

Symptoms:
- Error indicates missing `NEON_DATABASE_URL`.

Fix:
- Add `NEON_DATABASE_URL` as a Pages secret and redeploy.

## OpenRouter Test Fails

Checks:
- BYOK key is valid and active.
- Model name is correct (for example `openrouter/free`).
- Browser network allows outbound requests to OpenRouter.

## Steel.dev Test Fails

Checks:
- Steel BYOK key is valid.
- Optional project ID is correct.
- `/api/byok/steel/session` responds successfully.

## Build Fails in Frontend

Run:

```bash
npm install
npm run build
```

If lockfile drift exists, reinstall dependencies and rebuild.

## Legacy API Endpoints Missing

The current app implements core cloud endpoints (`health`, `config`, `credentials`, `byok/steel/session`).

If your UI requires additional routes, implement them in `functions/api/[[route]].ts`.
