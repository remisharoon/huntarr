# Deployment Guide

This project deploys to Cloudflare Pages.

## Current Recommended Deployment

- Frontend + Functions: Cloudflare Pages (repo root)
- Database: Neon PostgreSQL
- Auth: Clerk

## Primary Setup Docs

- `CLOUDFLARE_SETUP.md`
- `docs/CLOUDFLARE_PAGES.md`

## Cloudflare Pages Build Settings

- Root directory: `/` (repository root)
- Build command: `npm run build`
- Output directory: `dist`

## CLI Deploy

You can deploy from your machine with:

```bash
npm run deploy
```

This runs a production build and deploys `dist` to project `huntarr-web`.

## Required Runtime Variables

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `NEON_DATABASE_URL` (secret)

## Legacy Docs Deployment

MkDocs + GitHub Pages docs deployment still exists for documentation publishing, but app runtime deployment should use Cloudflare Pages.
