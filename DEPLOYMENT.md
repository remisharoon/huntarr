# Deployment Guide

This project is migrating to Cloudflare Pages deployment for the web app.

## Current Recommended Deployment

- Frontend + Functions: Cloudflare Pages (`apps/frontend`)
- Database: Neon PostgreSQL
- Auth: Clerk

## Primary Setup Docs

- `apps/frontend/CLOUDFLARE_SETUP.md`
- `docs/CLOUDFLARE_PAGES.md`

## Cloudflare Pages Build Settings

- Root directory: `apps/frontend`
- Build command: `npm run build`
- Output directory: `dist`

## Required Runtime Variables

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `NEON_DATABASE_URL` (secret)

## Legacy Docs Deployment

MkDocs + GitHub Pages docs deployment still exists for documentation publishing, but app runtime deployment should use Cloudflare Pages.
