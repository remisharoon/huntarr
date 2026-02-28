# Huntarr

Automated job research & application agent — set it loose, let it hunt.

## 📚 Documentation

- [**Quick Start**](docs/QUICKSTART.md) - Get up and running in 5 minutes
- [**User Guide**](docs/USER_GUIDE.md) - Complete manual for using Huntarr
- [**API Reference**](docs/API_REFERENCE.md) - REST API endpoints
- [**Architecture**](docs/ARCHITECTURE.md) - System design and components
- [**Configuration**](docs/CONFIGURATION.md) - Settings and environment variables
- [**Troubleshooting**](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [**Developer Guide**](docs/DEVELOPER_GUIDE.md) - Contributing and extending Huntarr

## ⚡ Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Build and start services
docker compose -f infra/docker/docker-compose.yml up --build

# 3. Access services
# Frontend:  http://localhost:5173
# API Docs:  http://localhost:8000/docs
# noVNC:     http://localhost:7900
```

## 🎯 Features

- **Automated Discovery** - Find jobs from multiple sources (RemoteOK, WeWorkRemotely, Brave Search)
- **Smart Ranking** - AI-powered job scoring with customizable filters
- **Automated Applications** - Browser automation with ATS-specific adapters (Greenhouse, Lever, Workday)
- **Secure Credentials** - Encrypted vault for storing ATS login credentials
- **Real-Time Monitoring** - SSE-based event streaming for live updates
- **Scheduled Runs** - Cron-based automated job hunting
- **Manual Interventions** - noVNC sessions for handling CAPTCHAs and challenges

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + Vite + Tailwind CSS |
| API | FastAPI + PostgreSQL + SSE |
| Worker | LangGraph + Playwright + PostgreSQL Queue |
| Infrastructure | Docker Compose |
| Manual Interventions | noVNC |

## 📁 Monorepo Layout

```
huntarr/
├── apps/
│   ├── frontend/     # React UI
│   ├── api/          # FastAPI backend
│   └── worker/       # LangGraph worker
├── packages/
│   └── core/         # Shared domain logic
├── docs/             # Documentation
├── tests/            # Test suite
└── infra/docker/     # Docker Compose configs
```

## 🔑 Key Concepts

- **Runs** - Automated job hunting sessions (manual or scheduled)
- **Profiles** - Your job application information and preferences
- **Jobs** - Discovered job postings from various sources
- **Applications** - Attempt records with status tracking
- **Manual Actions** - Human intervention for CAPTCHAs and challenges

## 📋 Supported ATS

- **Greenhouse** (`greenhouse.io`)
- **Lever** (`lever.co`)
- **Workday** (`myworkdayjobs.com`, `workday.com`)
- **Fallback** - Generic adapter for unknown forms

## 🔐 Security

- **Platform Restrictions** - LinkedIn, Indeed, Glassdoor login flows blocked
- **Company ATS Allowed** - Company ATS accounts (e.g., `acme.greenhouse.io`) permitted
- **Encrypted Credentials** - AES-GCM encryption with PBKDF2 key derivation

## 🤝 Contributing

See [Developer Guide](docs/DEVELOPER_GUIDE.md) for:
- Development setup
- Adding job connectors
- Creating ATS adapters
- Extending the agent graph
- Testing guidelines

## 📄 License

See LICENSE file.
