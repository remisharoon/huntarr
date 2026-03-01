---
title: Architecture - Huntarr
description: System architecture and design of Huntarr. Learn about the agent graph, browser automation, job discovery, database layer, and service architecture.
keywords: architecture, design, system, langgraph, playwright, database, service architecture
robots: index, follow
og:title: Architecture - Huntarr
og:description: System architecture and design of Huntarr.
og:type: website
og:url: https://remisharoon.github.io/huntarr/ARCHITECTURE/
twitter:card: summary
twitter:title: Architecture - Huntarr
twitter:description: System architecture and design of Huntarr.
---

# Architecture

System architecture and design of Huntarr.

## Overview

Huntarr is an automated job research and application agent built as a monorepo with a service-oriented architecture. It orchestrates job discovery, intelligent ranking, automated application submission via browser automation, and human-in-the-loop intervention for challenges.

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + Vite + Tailwind CSS |
| API | FastAPI + PostgreSQL + SSE |
| Worker | LangGraph + Playwright + PostgreSQL Queue |
| Infrastructure | Docker Compose |
| Manual Interventions | noVNC |

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                       │
│                     (React Frontend)                         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / SSE
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│                       (FastAPI)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Runs   │  │   Jobs   │  │ Profile  │  │ Schedules│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ PostgreSQL
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│                     (PostgreSQL)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Queue   │  │  Profile │  │   Jobs   │  │   Runs   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ Job Queue
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        Worker Layer                          │
│                    (LangGraph Runtime)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Agent Graph (State Machine)           │   │
│  │  Discover → Rank → Prepare → Fill → Submit           │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │               Browser Automation Engine             │   │
│  │              (Playwright + ATS Adapters)             │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │                Job Discovery Connectors             │   │
│  │     RemoteOK │ WeWorkRemotely │ Brave Search        │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      External Services                        │
│  ATS Systems (Greenhouse, Lever, Workday)                    │
│  Job Boards (RemoteOK, WeWorkRemotely)                      │
│  Search APIs (Brave Search)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Package Structure

```
packages/core/src/huntarr_core/
├── agent/                  # LangGraph workflow orchestration
│   ├── __init__.py
│   └── graph.py            # Main agent graph definition
├── browser/                # ATS adapter system
│   ├── __init__.py
│   ├── engine.py           # Playwright browser engine
│   └── adapters/           # ATS-specific adapters
│       ├── __init__.py
│       ├── base.py         # Abstract adapter base
│       ├── registry.py     # Adapter resolution
│       ├── greenhouse.py   # Greenhouse ATS adapter
│       ├── lever.py        # Lever ATS adapter
│       ├── workday.py      # Workday ATS adapter
│       └── fallback.py     # Generic fallback adapter
├── connectors/             # Job discovery connectors
│   ├── __init__.py
│   ├── base.py             # Abstract connector
│   ├── discovery.py        # Orchestrates job discovery
│   ├── policies.py         # Platform policies
│   ├── brave_search.py     # Brave Search connector
│   ├── remoteok.py         # RemoteOK connector
│   └── weworkremotely.py   # WeWorkRemotely connector
├── db/                     # Database layer
│   ├── pool.py             # Connection pool management
│   ├── repo.py             # Repository pattern (1000+ lines)
│   └── schema.sql          # Database schema
├── types.py                # Pydantic models (domain types)
├── constants.py            # Domain constants
├── utils.py                # Utilities (dedupe hashing, text normalization)
├── documents.py            # Resume/cover letter generation
├── ranking.py              # Job scoring algorithm
└── vault.py                # Credential encryption (AES-GCM)
```

---

## Agent Graph (LangGraph)

### State Definition

The agent graph maintains state in `HuntState`:

```python
class HuntState(TypedDict):
    run_id: str
    profile_id: str
    search_config: dict[str, Any]
    source_cursor: dict[str, Any]
    candidate_jobs: list[dict[str, Any]]    # Discovered jobs
    selected_jobs: list[dict[str, Any]]     # Filtered/ranked jobs
    job_cursor: int                          # Current job index
    current_job: dict[str, Any] | None
    apply_attempt: dict[str, Any]
    manual_action_id: str | None
    artifacts: dict[str, Any]
    errors: list[str]
    metrics: dict[str, Any]                  # applied, failed, manual_required, skipped
    generated_docs: dict[str, str]
    pause_requested: bool
    challenge_detected: bool
    run_complete: bool
```

### Workflow Graph (13 Nodes)

```
START
  ↓
load_profile_and_prefs
  ↓
discover_jobs
  ↓
normalize_and_dedupe
  ↓
rank_and_filter
  ↓
pick_next_job
  ↙ (more jobs?)        ↘ (done?)
prepare_documents       finalize_run → END
  ↓
open_application_flow
  ↓
handle_account_step
  ↓
fill_form
  ↓
answer_questionnaire
  ↓
detect_challenge
  ↙ (challenge?)        ↘ (no challenge)
manual_intervention_wait submit_application
  ↓                         ↓
persist_result_and_metrics ← verify_submission
  ↓
pick_next_job ────────────┘
```

### Node Descriptions

| Node | Description |
|------|-------------|
| `load_profile_and_prefs` | Load user profile and search preferences |
| `discover_jobs` | Fetch jobs from all connectors |
| `normalize_and_dedupe` | Standardize job data and remove duplicates |
| `rank_and_filter` | Score jobs and filter by threshold |
| `pick_next_job` | Select next job to apply to (or finalize) |
| `prepare_documents` | Generate resume PDF and cover letter |
| `open_application_flow` | Navigate to application page |
| `handle_account_step` | Handle login/create account (with policy checks) |
| `fill_form` | Fill out application form using ATS adapter |
| `answer_questionnaire` | Answer screening questions |
| `detect_challenge` | Check for CAPTCHA or challenges |
| `manual_intervention_wait` | Wait for human intervention (if needed) |
| `submit_application` | Submit the form |
| `verify_submission` | Confirm successful submission |
| `persist_result_and_metrics` | Save results to database |
| `finalize_run` | Complete the run |

### Key Workflow Patterns

1. **Checkpointing**: State is persisted to database after each node execution
2. **Conditional Routing**: Multiple decision points (jobs remaining, challenges)
3. **Resume Capability**: Can pause at any point and resume from saved state
4. **Event Logging**: Every node emits structured events to `run_events` table

---

## Browser Automation

### Browser Engine (Playwright)

The `ApplicationEngine` in `packages/core/src/huntarr_core/browser/engine.py` provides:

**Key Features**:
- Playwright-based automation with randomized user agents
- Random delays (0.9-1.8s) between actions for human-like behavior
- Screenshot capture: landing, postfill, result
- CAPTCHA detection: Multiple selector strategies (iframes, reCAPTCHA, text patterns)
- Login gate detection: Detects sign-in requirements
- Platform policy enforcement: Skips restricted platforms (LinkedIn, Indeed, Glassdoor)
- Auto-submit toggle: Configurable via `AUTO_SUBMIT_ENABLED`

**Error Handling**:
- `manual_required` - CAPTCHA or unexpected form detected
- `skipped` - Restricted platform login required
- `failed` - Playwright errors
- `submitted` - Successful submission

### ATS Adapters

Adapter hierarchy implements the adapter pattern:

```
AtsAdapter (Abstract Base)
    ├── GreenhouseAdapter
    ├── LeverAdapter
    ├── WorkdayAdapter
    └── FallbackAdapter
```

**Base Class (`AtsAdapter`)**:

```python
class AtsAdapter(ABC):
    @abstractmethod
    def matches(url: str) -> bool:
        """Check if this adapter matches the URL"""
        pass

    @abstractmethod
    async def prefill(page, profile, docs) -> AdapterResult:
        """Fill out the application form"""
        pass

    @abstractmethod
    async def submit(page) -> bool:
        """Submit the form"""
        pass

    @abstractmethod
    async def extract_confirmation(page) -> str | None:
        """Extract success message"""
        pass
```

**Adapter Registry**:

Adapters are registered in `registry.py` and matched in order:
1. Greenhouse (if URL matches `*.greenhouse.io`)
2. Lever (if URL matches `*.lever.co`)
3. Workday (if URL matches `*.myworkdayjobs.com` or `*.workday.com`)
4. Fallback (generic, label-based filling)

### Supported ATS Systems

| ATS | Domain Pattern | Features |
|-----|----------------|----------|
| **Greenhouse** | `*.greenhouse.io` | Standard form fields, file upload |
| **Lever** | `*.lever.co` | `data-qa` attributes, cover letter |
| **Workday** | `*.myworkdayjobs.com`, `*.workday.com` | Multi-step forms, "Next" button |
| **Fallback** | All others | Label-based filling, best-effort |

---

## Job Discovery

### Connector Architecture

**Abstract Base (`JobConnector`)**:

```python
class JobConnector(ABC):
    source_name: str

    @abstractmethod
    async def fetch_jobs(self, config: SearchConfig) -> list[dict]:
        """Fetch jobs from this source"""
        pass
```

### Implemented Connectors

| Connector | API | Type |
|-----------|-----|------|
| RemoteOK | https://remoteok.com/api | REST API |
| WeWorkRemotely | https://weworkremotely.com/remote-jobs.rss | RSS Feed |
| Brave Search | https://api.search.brave.com/res/v1/web/search | Web Search API |

### Discovery Pipeline

```
1. Parallel Fetch (asyncio.gather)
   ├── RemoteOK Connector
   ├── WeWorkRemotely Connector
   └── Brave Search Connector
        ↓
2. Policy Filtering
   ├── Robots.txt compliance
   └── Platform restrictions
        ↓
3. Deduplication
   └── SHA256 hash of (title, company, location, domain)
        ↓
4. Store to Database
   └── job_postings + job_dedupe_map
```

### Platform Policies

**Restricted Platforms** (login flows blocked):
- `linkedin.com`
- `indeed.com`
- `glassdoor.com`

**Allowed** (company ATS accounts):
- `*.greenhouse.io`
- `*.lever.co`
- `*.myworkdayjobs.com`
- `*.workday.com`

---

## Ranking Algorithm

### Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Keyword Match | 40% | Match `role_keywords` in title/description |
| Location Match | 30% | Match location preferences |
| Skills Match | 20% | Overlap between profile skills and job description |
| Natural Language | 10% | Semantic similarity (if `natural_language_override` set) |

### Score Calculation

```
total_score = keyword_score + location_score + skills_score + nl_score

Where:
keyword_score = (matched_keywords / total_keywords) * 40
location_score = (location_match ? 30 : 0)
skills_score = (matched_skills / total_skills) * 20
nl_score = (similarity_score) * 10  (if applicable)
```

### Threshold

Jobs below score threshold (default: 50) are filtered out.

### Score Explanation

Each job includes a `score_explanation` field:

```json
{
  "matched_keywords": ["backend", "python"],
  "excluded_keywords": [],
  "remote_bias": true,
  "location_match": ["remote"],
  "skills_match": ["python", "fastapi", "postgresql"]
}
```

---

## Database Layer

### Schema Overview

**Core Tables** (15 tables):

| Table | Description |
|-------|-------------|
| `profiles` | User profile data (skills, experience, education) |
| `search_preferences` | Search configuration per profile |
| `credentials_vault` | Encrypted credentials (AES-GCM) |
| `job_postings` | Job listings from various sources |
| `job_dedupe_map` | Deduplication hash map |
| `job_scores` | Relevance scores with explanations |
| `run_sessions` | Agent workflow runs with state |
| `run_events` | Structured event log (SSE feed) |
| `applications` | Application attempts and results |
| `application_answers` | Questionnaire responses |
| `manual_actions` | Human-in-the-loop interventions |
| `generated_documents` | Resume/cover letter artifacts |
| `job_queue` | Work queue with `FOR UPDATE SKIP LOCKED` |
| `schedules` | Cron-based run scheduling |
| `configs` | System configuration |

### Repository Pattern

The `HuntRepo` class in `packages/core/src/huntarr_core/db/repo.py` implements:

**Key Features**:
- **JSON Normalization**: Automatic serialization/deserialization of JSONB columns
- **Queue Management**: Atomic job claiming with PostgreSQL advisory locks
- **State Persistence**: Save/restore agent state for resume capability
- **Event Streaming**: Cursor-based event fetching for SSE
- **Upsert Pattern**: Atomic create-or-update operations
- **Transaction Wrappers**: Context managers for multi-step operations

### Queue Implementation

```sql
SELECT * FROM job_queue
WHERE status = 'pending'
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

This provides:
- Concurrent-safe job processing
- No external queue system needed (Redis, etc.)
- Simple, reliable, database-backed

### Indexes

Key database indexes for performance:

| Index | Table | Purpose |
|-------|-------|---------|
| `job_postings_dedupe_hash` | job_postings | Fast dedupe lookups |
| `job_scores_score` | job_scores | Sorted job ranking |
| `job_queue_pending` | job_queue | Queue processing |
| `run_events_run_id_id` | run_events | Event streaming |
| `manual_actions_status` | manual_actions | Manual action prioritization |

---

## Service Architecture

### API Service (`apps/api`)

**Responsibilities**:
- REST API endpoints (17+ endpoints)
- Run lifecycle management (create, pause, resume)
- SSE event streaming for real-time updates
- Profile management (CRUD, resume upload/parse)
- Manual action orchestration
- Configuration management
- Credential storage (encrypted)

### Worker Service (`apps/worker`)

**Responsibilities**:
- Queue processing loop (poll interval: 2s)
- Schedule execution (cron-based)
- LangGraph workflow execution
- Error handling with exponential backoff
- Manual action detection and pause

**Worker Loop**:

```python
while True:
    await process_due_schedules()  # Check cron schedules
    job = await repo.claim_next_job(worker_id)  # SKIP LOCKED
    if job:
        await handle_job(job)
    else:
        await sleep(poll_interval)
```

### Frontend Service (`apps/frontend`)

**Architecture**:
- React 19 + Vite
- Tailwind CSS + shadcn-style components
- 5-page SPA: Dashboard, Jobs, Manual Queue, Profile, Runs

**State Management**:
- Local component state (runs, jobs, applications, manualActions, profile)
- 8-second polling refresh interval
- Shared state passed to page components

---

## Data Flow

### Job Application Flow

```
Frontend (Apply Now)
  ↓ POST /api/jobs/{id}/apply-now
API
  ↓ create_run() + enqueue_job()
Database (job_queue)
  ↓ claim_next_job() [SKIP LOCKED]
Worker
  ↓ execute_run()
LangGraph (HuntGraphRunner)
  ├─ load_profile_and_prefs
  ├─ pick_next_job (from state)
  ├─ prepare_documents (resume PDF + cover letter)
  ├─ open_application_flow
  ├─ handle_account_step (policy check)
  ├─ fill_form (ApplicationEngine → Playwright → ATS Adapter)
  ├─ answer_questionnaire
  ├─ detect_challenge
  ├─ submit_application (if no challenge)
  ├─ verify_submission
  └─ persist_result_and_metrics
Database (applications, run_events)
  ↓ SSE stream
Frontend (real-time updates)
```

### Manual Intervention Flow

```
Worker (detects CAPTCHA)
  ↓ create_manual_action()
Database (manual_actions, status='pending')
  ↓ pause_run() + save_run_state()
API (pause)
  ↓ SSE event
Frontend (shows manual action)
User clicks "Start Session"
  ↓ POST /api/manual-actions/{id}/start-session
API
  ↓ update_manual_action_session(status='in_progress')
  ↓ return noVNC URL (http://localhost:7900)
Frontend (opens VNC in new tab)
User manually resolves CAPTCHA
User clicks "Resolve"
  ↓ POST /api/manual-actions/{id}/resolve
API
  ↓ resolve_manual_action(status='resolved')
  ↓ enqueue_job() (resume run)
Database
  ↓ claim_next_job()
Worker
  ↓ execute_run() (resume from state)
```

### Scheduled Run Flow

```
Cron Schedule (stored in schedules table)
  ↓ Worker.process_due_schedules() [every 2s]
Worker
  ↓ create_run(mode='scheduled')
  ↓ enqueue_job()
Queue
  ↓ claim_next_job()
Worker
  ↓ execute_run() (full discovery pipeline)
```

---

## Integration Points

### 1. Database Integration
- **Shared Schema**: API, Worker, and Scheduler all use `HuntRepo`
- **Queue Table**: Worker claims jobs from `job_queue`
- **State Table**: Agent state persisted in `run_sessions.state_json`
- **Events Table**: SSE stream reads from `run_events`

### 2. API ↔ Worker Integration
- **Queue-based**: API enqueues jobs, Worker dequeues
- **State Sharing**: Run state saved in DB, loaded by Worker
- **Event Streaming**: Worker emits events, API streams via SSE

### 3. Worker ↔ Browser Automation
- **Playwright**: Direct browser automation
- **noVNC**: For manual intervention sessions
- **Screenshots**: Saved to shared `/data/artifacts` volume

### 4. Frontend ↔ API Integration
- **REST API**: Standard CRUD operations
- **SSE**: Real-time event streaming
- **Polling**: 8-second interval for general updates
- **File Upload**: Resume PDF parsing via pypdf

### 5. Volume Sharing (Docker)
- `artifacts_data` - Screenshots, generated documents
- `uploads_data` - Uploaded resumes
- `browser_session_data` - Playwright browser state
- `postgres_data_v2` - PostgreSQL data

---

## Design Patterns

### 1. Repository Pattern
Centralized data access in `HuntRepo` with JSON normalization, queue management, and transaction wrappers.

### 2. Abstract Base Classes
`JobConnector` and `AtsAdapter` for extensibility - add new connectors or adapters by implementing the base class.

### 3. Adapter Registry
Chain-of-responsibility for ATS detection - adapters are tried in order until one matches.

### 4. State Machine
LangGraph for workflow orchestration - state is persisted and can be resumed from any point.

### 5. Strategy Pattern
Different ranking/selection strategies possible - customize scoring algorithm.

### 6. Human-in-the-Loop
Manual intervention for CAPTCHAs and challenges - run is paused, state saved, resumed after resolution.

### 7. Queue with SKIP LOCKED
PostgreSQL advisory locks for concurrent-safe job processing without external queue system.

---

## Security Considerations

1. **Credential Storage**: AES-GCM encryption with PBKDF2 (390k iterations)
2. **Platform Restrictions**: LinkedIn/Indeed/Glassdoor blocked
3. **Rate Limiting**: Random delays, user agent rotation
4. **Input Validation**: Pydantic models for all inputs
5. **SQL Injection**: Parameterized queries throughout
6. **File Upload**: PDF only, size limits
7. **CORS**: Configurable (currently permissive for dev)

---

For more information, see:
- [Quick Start](QUICKSTART.md)
- [User Guide](USER_GUIDE.md)
- [Configuration](CONFIGURATION.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
