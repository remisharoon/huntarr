---
title: Huntarr Documentation
description: Huntarr cloud architecture docs for Cloudflare Pages, NeonDB, Clerk, OpenRouter BYOK, and Steel.dev BYOK.
keywords: huntarr, cloudflare pages, neondb, clerk, openrouter, steel.dev, byok
robots: index, follow
---

# Huntarr Documentation

Huntarr is moving to a cloud-first architecture focused on:

- Cloudflare Pages (frontend + Pages Functions)
- NeonDB (PostgreSQL)
- Clerk authentication
- OpenRouter BYOK for AI
- Steel.dev BYOK for browser automation

## Start Here

- [Quick Start](QUICKSTART.md)
- [Cloudflare Pages Setup](CLOUDFLARE_PAGES.md)
- [Configuration](CONFIGURATION.md)
- [API Reference](API_REFERENCE.md)

## Migration Notes

- This repo is now React-first and Cloudflare Pages-first.
- Core app code lives at repo root in `src/` and `functions/`.
- BYOK policy is used for both OpenRouter and Steel.dev.

## Reference

- [Architecture](ARCHITECTURE.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
