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

## Apply Stuck in `manual_required`

Symptoms:

- Application status remains `manual_required` after clicking Apply.

Checks:

- Open the job portal link in Manual Queue and complete final portal submission.
- If portal completion is blocked, click **Start Live Session (uses Steel credits)** to launch on-demand automation.
- In Manual Queue, resolve the manual action once submit is complete.
- Ensure ATS credentials (if required) are present in Settings.
- Confirm job posting URL is valid and reachable.

If **Start Live Session** is unavailable:

- The ATS may be in strict no-Steel mode (`workday`, `smartrecruiters`, `ashby`, `bamboohr`, `icims`, `taleo`) to reduce monthly spend.
- Continue in portal/manual mode for this role.
- You can change this policy in Settings (Application Behavior section).

## Auto-submit Fails But Session Opens

Symptoms:

- Apply does not auto-submit, and a manual action is created.

Checks:

- ATS API auto-submit is currently only implemented for Lever and Greenhouse.
- For unsupported ATS, manual completion is expected.
- For Lever/Greenhouse, verify posting URL format and required fields (email/name/phone).

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
