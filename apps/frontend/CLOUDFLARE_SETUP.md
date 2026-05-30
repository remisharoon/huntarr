# Cloudflare Pages Setup

This frontend now supports:

- Clerk authentication in the browser
- React Router-based URLs
- Cloudflare Pages Functions API routes under `functions/api/[[route]].ts`
- NeonDB-backed config and credential storage
- BYOK policy for OpenRouter and Steel.dev

## 1) Local env

Create `apps/frontend/.env`:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE=
```

Leave `VITE_API_BASE` empty for same-origin `/api/*` on Cloudflare Pages.

## 2) Cloudflare Pages project variables

Set these in Pages settings:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`

Set this as a secret:

- `NEON_DATABASE_URL`

## 3) NeonDB schema requirement

The new Pages API uses table `configs` for user-scoped settings/credentials.
Ensure the `configs` table exists before deploying.

## 4) BYOK behavior

- OpenRouter key is stored as credential domain `openrouter.ai`, username `default`
- Steel key is stored as credential domain `steel.dev`, username `default`
- Steel test calls are proxied through `POST /api/byok/steel/session`

## 5) Build

```bash
npm install
npm run build
```
