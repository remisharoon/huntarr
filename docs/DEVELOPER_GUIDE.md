---
title: Developer Guide
description: Contributing guide for Huntarr cloud migration stack.
---

# Developer Guide

## Scope

This guide targets the new cloud stack in `apps/frontend`.

## Local Development

```bash
cd apps/frontend
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
cd apps/frontend
npm run build
```

## Key Directories

- `apps/frontend/src` - UI, routing, client API
- `apps/frontend/functions` - Cloudflare Pages Functions API
- `apps/frontend/wrangler.toml` - Cloudflare config
- `apps/frontend/CLOUDFLARE_SETUP.md` - deployment runbook

## Auth + API Flow

1. Clerk signs in user in browser.
2. Frontend API client injects bearer token.
3. Pages Function verifies token via Clerk JWKS.
4. Function executes NeonDB query and returns JSON.

## BYOK Development

- OpenRouter key and Steel key are stored as user credentials.
- Test paths are available in Settings UI.
- Use migration-safe keys in `configs` table during transition.

## Coding Notes

- Prefer TypeScript changes under `apps/frontend/src/*.ts(x)`.
- Keep endpoints user-scoped.
- Avoid introducing shared server keys for AI/automation providers.

## Migration Note

Legacy Python code remains in repo, but cloud work should be implemented in `apps/frontend` and `apps/frontend/functions`.
