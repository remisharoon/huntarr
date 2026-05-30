---
title: Developer Guide
description: Contributing guide for Huntarr cloud stack.
---

# Developer Guide

## Scope

This guide targets the cloud stack in this repository.

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
npm run build
```

## Key Directories

- `src` - UI, routing, client API
- `functions` - Cloudflare Pages Functions API
- `wrangler.toml` - Cloudflare config
- `CLOUDFLARE_SETUP.md` - deployment runbook

## Auth + API Flow

1. Clerk signs in user in browser.
2. Frontend API client injects bearer token.
3. Pages Function verifies token via Clerk JWKS.
4. Function executes NeonDB query and returns JSON.

## BYOK Development

- OpenRouter key and Steel key are stored as user credentials.
- Test paths are available in Settings UI.
- Use user-scoped keys in the `configs` table.

## Coding Notes

- Prefer TypeScript changes under `src/*.ts(x)`.
- Keep endpoints user-scoped.
- Avoid introducing shared server keys for AI/automation providers.

## Project Direction

This repository is React-first and Cloudflare Pages-first.
