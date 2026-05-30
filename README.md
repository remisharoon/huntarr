# Huntarr

Automated job research and application assistant.

Huntarr is a React-first web app for Cloudflare Pages with NeonDB, Clerk auth, and BYOK providers.

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
cp .env.example .env
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Scripts

```bash
npm run dev        # Local Vite development server
npm run build      # Typecheck + production build
npm run preview    # Preview production bundle locally
npm run deploy     # Build and deploy to Cloudflare Pages
```

## Cloudflare Deployment

See `CLOUDFLARE_SETUP.md` and `docs/CLOUDFLARE_PAGES.md`.

## License

See `LICENSE`.
