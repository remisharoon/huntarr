---
title: Quick Start - Huntarr Cloud
description: Run Huntarr frontend locally and deploy to Cloudflare Pages with NeonDB and Clerk.
---

# Quick Start

This quick start targets the new cloud architecture.

## Prerequisites

- Node.js 20+
- npm
- Cloudflare account
- Neon account
- Clerk account

## 1) Run Frontend Locally

```bash
cd apps/frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## 2) Configure Frontend Env

Set these values in `apps/frontend/.env`:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE=
```

- Leave `VITE_API_BASE` empty for same-origin `/api/*` on Pages.

## 3) Prepare NeonDB

1. Create a Neon project.
2. Run the schema that includes the `configs` table (already present in this repo schema).
3. Copy connection string for `NEON_DATABASE_URL`.

## 4) Configure Cloudflare Pages

Use `apps/frontend/wrangler.toml` and set variables/secrets:

- Variable: `VITE_CLERK_PUBLISHABLE_KEY`
- Variable: `CLERK_JWKS_URL`
- Variable: `CLERK_ISSUER`
- Secret: `NEON_DATABASE_URL`

## 5) BYOK in Settings

After signing in:

- Add OpenRouter key (domain `openrouter.ai`, username `default`)
- Add Steel.dev key (domain `steel.dev`, username `default`)
- Test both from the Settings page

## 6) Build Check

```bash
cd apps/frontend
npm run build
```

## Next

- [Cloudflare Pages Setup](CLOUDFLARE_PAGES.md)
- [Configuration](CONFIGURATION.md)
- [Troubleshooting](TROUBLESHOOTING.md)
