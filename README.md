# Huntarr

Automated job research and application assistant.

Huntarr is migrating from a Python worker stack to a Cloudflare Pages web app with NeonDB, Clerk auth, and BYOK providers.

## Documentation

- [Quick Start](docs/QUICKSTART.md)
- [Cloudflare Pages Setup](docs/CLOUDFLARE_PAGES.md)
- [Configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Developer Guide](docs/DEVELOPER_GUIDE.md)

## Current Direction

- Frontend: React + Vite + Tailwind + React Router
- Auth: Clerk
- Data: Neon PostgreSQL
- Hosting: Cloudflare Pages + Pages Functions
- AI: OpenRouter (BYOK)
- Browser automation: Steel.dev (BYOK)

## Local Frontend Quick Start

```bash
cd apps/frontend
cp .env.example .env
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Cloudflare Deployment

See `apps/frontend/CLOUDFLARE_SETUP.md` and `docs/CLOUDFLARE_PAGES.md`.

## Legacy Stack

The previous Docker/FastAPI/worker stack remains in the repo during migration. It is documented for reference but is no longer the target architecture.

## License

See `LICENSE`.
