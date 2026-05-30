---
title: Cloudflare Pages Setup
description: Deploy Huntarr frontend and Pages Functions to Cloudflare with NeonDB and Clerk.
---

# Cloudflare Pages Setup

## Overview

Huntarr deploys as:

- Static frontend from `dist`
- API from `functions/api/[[route]].ts`
- NeonDB for storage
- Clerk for auth

## Required Environment

### Frontend variables

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_BASE` (optional; empty recommended)

### Pages Function variables

- `CLERK_JWKS_URL`
- `CLERK_ISSUER`

### Pages Function secrets

- `NEON_DATABASE_URL`

## Deploy Steps

1. Connect repository to Cloudflare Pages.
2. Set project root to `/` (repository root).
3. Build command: `npm run build`.
4. Build output directory: `dist`.
5. Add env vars and secrets above.
6. Deploy.

## Auth Notes

- Pages Functions expect a Clerk bearer token.

## BYOK Notes

- OpenRouter key is user-managed and stored in `configs` namespace under credentials.
- Steel.dev key is user-managed and used for session creation via `/api/byok/steel/session`.

## Validation

- `GET /api/health`
- Sign in with Clerk
- Open Settings and test OpenRouter key
- Open Settings and test Steel key
