---
title: Huntarr - Automated Job Research & Application Agent
description: Huntarr is an automated job research and application agent. Discover, rank, and apply to jobs automatically with AI-powered ranking and browser automation.
keywords: job automation, job search, job application, ATS, browser automation, remote jobs
robots: index, follow
og:title: Huntarr - Automated Job Research & Application Agent
og:description: Set it loose, let it hunt. Automated job discovery, intelligent ranking, and automated applications.
og:type: website
og:url: https://huntarr.github.io/huntarr/
og:image: https://huntarr.github.io/huntarr/assets/social-card.png
twitter:card: summary_large_image
twitter:title: Huntarr - Automated Job Research & Application Agent
twitter:description: Automated job discovery, intelligent ranking, and automated applications.
twitter:image: https://huntarr.github.io/huntarr/assets/social-card.png
---

# Huntarr Documentation

Welcome to the Huntarr documentation hub. Huntarr is an automated job research & application agent — set it loose, let it hunt.

## Quick Links

- [Quick Start Guide](QUICKSTART.md) - Get up and running in 5 minutes
- [User Guide](USER_GUIDE.md) - Complete manual for using Huntarr
- [Architecture](ARCHITECTURE.md) - System design and components
- [API Reference](API_REFERENCE.md) - REST API endpoints
- [Configuration](CONFIGURATION.md) - Settings and environment variables
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Developer Guide](DEVELOPER_GUIDE.md) - Contributing and extending Huntarr

## Overview

Huntarr automates the entire job application workflow:

1. **Job Discovery** - Finds relevant jobs from multiple sources (RemoteOK, WeWorkRemotely, Brave Search)
2. **Intelligent Ranking** - Scores jobs based on your profile, skills, and preferences
3. **Automated Application** - Fills out application forms using browser automation with ATS-specific adapters
4. **Human-in-the-Loop** - Handles CAPTCHAs and challenges through manual intervention sessions

## Key Features

- 🤖 **Automated Discovery** - Discover jobs from multiple sources simultaneously
- 🎯 **Smart Ranking** - AI-powered job scoring with customizable filters
- 🚀 **Automated Applications** - Browser automation with ATS-specific adapters (Greenhouse, Lever, Workday)
- 🔐 **Secure Credentials** - Encrypted vault for storing ATS login credentials
- 📊 **Real-Time Monitoring** - SSE-based event streaming for live updates
- 🔄 **Scheduled Runs** - Cron-based automated job hunting
- 🖥️ **Manual Interventions** - noVNC sessions for handling CAPTCHAs and challenges
- 📝 **Resume Parsing** - Upload and parse your resume PDF

## Technology Stack

- **Frontend**: React 19 + Vite + Tailwind CSS (shadcn-style components)
- **API**: FastAPI + PostgreSQL + Server-Sent Events (SSE)
- **Worker**: LangGraph + Playwright + PostgreSQL queue (`FOR UPDATE SKIP LOCKED`)
- **Infrastructure**: Docker Compose (local-first)
- **Manual Interventions**: noVNC browser session (`playwright-vnc` service)

## Monorepo Layout

```
huntarr/
├── apps/
│   ├── frontend/     # React UI (dashboard/jobs/manual queue/profile/runs)
│   ├── api/          # FastAPI backend + endpoints
│   └── worker/       # Queue worker + LangGraph runtime
├── packages/
│   └── core/         # Shared domain types, DB schema/repo, connectors, browser engine, graph
├── infra/
│   └── docker/       # Docker Compose configurations
├── docs/             # Documentation (you are here)
└── tests/            # Test suite
```

## Quick Start

1. **Copy environment template**:

```bash
cp .env.example .env
```

2. **Build and start**:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

3. **Open services**:
- Frontend: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- noVNC session: [http://localhost:7900](http://localhost:7900)

## Core Concepts

### Runs
A **run** is an automated job hunting session. Runs can be:
- **Manual** - Triggered on-demand (apply-now or full discovery)
- **Scheduled** - Triggered via cron expression

### Profiles
A **profile** contains your job application information:
- Skills and experience
- Education background
- Search preferences (keywords, locations, salary range)
- Resume (uploaded and parsed)

### Jobs
**Jobs** are discovered job postings from various sources. Each job has:
- Source (RemoteOK, WeWorkRemotely, Brave Search)
- Company and title
- Location and description
- URL to the application page
- Deduplication hash (to prevent duplicates)

### Applications
An **application** is an attempt to apply to a job. Applications can have these statuses:
- `queued` - Waiting to be processed
- `in_progress` - Currently being processed
- `submitted` - Successfully submitted
- `failed` - Failed to submit (error)
- `manual_required` - Requires human intervention (CAPTCHA)
- `skipped` - Skipped (restricted platform or policy violation)

### Manual Actions
A **manual action** is created when the system detects a challenge (CAPTCHA, 2FA, email verification). You can:
- Start a noVNC browser session
- Resolve the challenge manually
- Resume the run

## Supported ATS Systems

Huntarr includes specialized adapters for these application tracking systems:

- **Greenhouse** (`greenhouse.io`)
- **Lever** (`lever.co`)
- **Workday** (`myworkdayjobs.com`, `workday.com`)
- **Fallback** - Generic adapter for unknown forms

## Platform Policies

Huntarr enforces strict platform policies:
- **Restricted platforms** (LinkedIn, Indeed, Glassdoor): Login flows are prohibited
- **Company ATS accounts**: Allowed (e.g., `acmecorp.greenhouse.io`)
- **Authenticated apply flows**: Blocked on restricted platforms

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/runs` | Create a new run |
| GET | `/api/runs` | List runs |
| GET | `/api/runs/{id}` | Get run details |
| POST | `/api/runs/{id}/pause` | Pause a run |
| POST | `/api/runs/{id}/resume` | Resume a paused run |
| GET | `/api/runs/{id}/events` | SSE event stream |
| GET | `/api/jobs` | List jobs |
| GET | `/api/jobs/{id}` | Get job details |
| POST | `/api/jobs/{id}/apply-now` | Apply to a specific job now |
| GET | `/api/applications` | List applications |
| GET | `/api/manual-actions` | List manual actions |
| POST | `/api/manual-actions/{id}/start-session` | Start manual intervention session |
| POST | `/api/manual-actions/{id}/resolve` | Resolve manual action |
| GET | `/api/profile` | Get profile |
| PUT | `/api/profile` | Update profile |
| POST | `/api/profile/resume-upload` | Upload resume |
| POST | `/api/profile/parse-resume` | Parse resume PDF |
| GET | `/api/config` | Get system config |
| PUT | `/api/config` | Update system config |
| POST | `/api/credentials` | Store encrypted credential |
| POST | `/api/schedules` | Create schedule |
| GET | `/api/schedules` | List schedules |

See [API Reference](API_REFERENCE.md) for detailed documentation.

## Getting Help

- Check the [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues
- Review [Configuration](CONFIGURATION.md) for settings
- See [Developer Guide](DEVELOPER_GUIDE.md) for contributing

## License

See LICENSE file.
