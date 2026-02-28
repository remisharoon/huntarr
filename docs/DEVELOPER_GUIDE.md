# Developer Guide

Guide for contributing to and extending Huntarr.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Core Package](#core-package)
4. [Adding Job Connectors](#adding-job-connectors)
5. [Creating ATS Adapters](#creating-ats-adapters)
6. [Extending the Agent Graph](#extending-the-agent-graph)
7. [Database Schema](#database-schema)
8. [API Development](#api-development)
9. [Frontend Development](#frontend-development)
10. [Testing](#testing)
11. [Code Style](#code-style)
12. [Deployment](#deployment)

---

## Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Docker and Docker Compose
- Git

### Local Development (Without Docker)

#### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd huntarr
```

#### 2. Set Up PostgreSQL

```bash
# Using Docker for local database
docker run -d \
  --name huntarr-postgres \
  -e POSTGRES_DB=huntarr \
  -e POSTGRES_USER=huntarr \
  -e POSTGRES_PASSWORD=huntarr \
  -p 5432:5432 \
  postgres:15
```

#### 3. Set Up Python Virtual Environment

```bash
cd packages/core
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -e .
```

#### 4. Set Up Worker

```bash
cd apps/worker
pip install -e .
```

#### 5. Set Up API

```bash
cd apps/api
pip install -e .
```

#### 6. Set Up Frontend

```bash
cd apps/frontend
npm install
```

#### 7. Configure Environment

Create `.env` file:

```bash
DATABASE_URL=postgresql+asyncpg://huntarr:huntarr@localhost:5432/huntarr
VAULT_MASTER_PASSPHRASE=your-secure-passphrase
BRAVE_API_KEY=your-brave-api-key  # Optional
```

#### 8. Initialize Database

```bash
cd packages/core
python -c "from huntarr_core.db.pool import init_db_schema; import asyncio; asyncio.run(init_db_schema(asyncio.run(create_db_pool('postgresql+asyncpg://huntarr:huntarr@localhost:5432/huntarr'))))"
```

#### 9. Run Services

```bash
# Terminal 1: API
cd apps/api
python -m huntarr_api.main

# Terminal 2: Worker
cd apps/worker
python -m huntarr_worker.main

# Terminal 3: Frontend
cd apps/frontend
npm run dev
```

### Docker Development

```bash
# Build and start all services
docker compose -f infra/docker/docker-compose.yml up --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

---

## Project Structure

```
huntarr/
├── apps/
│   ├── api/              # FastAPI backend
│   │   ├── src/huntarr_api/
│   │   │   ├── main.py   # API endpoints
│   │   │   ├── config.py # Configuration
│   │   │   └── schemas.py # Pydantic models
│   │   └── pyproject.toml
│   ├── worker/           # LangGraph worker
│   │   ├── src/huntarr_worker/
│   │   │   ├── main.py   # Worker entry point
│   │   │   └── config.py
│   │   └── pyproject.toml
│   └── frontend/         # React UI
│       ├── src/
│       │   ├── pages/    # Page components
│       │   ├── components/ # UI components
│       │   ├── lib/      # Utilities and API client
│       │   └── main.tsx  # Entry point
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       └── package.json
├── packages/
│   └── core/            # Shared core package
│       ├── src/huntarr_core/
│       │   ├── agent/   # LangGraph graph
│       │   ├── browser/ # Browser automation
│       │   ├── connectors/ # Job discovery
│       │   ├── db/      # Database layer
│       │   ├── types.py # Domain types
│       │   └── ...
│       └── pyproject.toml
├── tests/               # Test suite
│   ├── core/            # Core package tests
│   └── conftest.py      # Pytest configuration
├── docs/                # Documentation
├── infra/
│   └── docker/          # Docker configurations
│       └── docker-compose.yml
├── Makefile             # Common commands
├── .env.example         # Environment template
└── README.md
```

---

## Core Package

The core package (`packages/core`) contains shared business logic.

### Key Modules

| Module | Description |
|--------|-------------|
| `agent/graph.py` | LangGraph workflow orchestration |
| `browser/engine.py` | Playwright browser engine |
| `browser/adapters/` | ATS-specific adapters |
| `connectors/discovery.py` | Job discovery orchestrator |
| `connectors/base.py` | Base connector class |
| `db/repo.py` | Repository pattern implementation |
| `db/schema.sql` | Database schema |
| `types.py` | Pydantic domain models |
| `ranking.py` | Job scoring algorithm |
| `documents.py` | Resume/cover letter generation |
| `vault.py` | Credential encryption |

### Using the Core Package

```python
from huntarr_core.db.pool import create_db_pool
from huntarr_core.db.repo import HuntRepo
from huntarr_core.agent.graph import HuntGraphRunner
from huntarr_core.types import SearchConfig
from pathlib import Path

# Create database pool
pool = await create_db_pool("postgresql+asyncpg://...")
await init_db_schema(pool)

# Create repository
repo = HuntRepo(pool)

# Create graph runner
runner = HuntGraphRunner(repo, artifact_root=Path("/data/artifacts"))

# Run graph
state = await runner.graph.ainvoke({
    "run_id": "...",
    "profile_id": "...",
    "search_config": {...}
})
```

---

## Adding Job Connectors

Add a new job source to discover jobs from.

### 1. Create Connector Class

Create `packages/core/src/huntarr_core/connectors/myconnector.py`:

```python
from __future__ import annotations

import logging
from typing import Any

from huntarr_core.connectors.base import JobConnector
from huntarr_core.types import SearchConfig

logger = logging.getLogger(__name__)


class MyConnector(JobConnector):
    source_name = "myconnector"

    async def fetch_jobs(self, config: SearchConfig) -> list[dict[str, Any]]:
        """Fetch jobs from this source."""
        jobs = []

        try:
            # Implement your job fetching logic here
            # Example: Make API call, scrape webpage, parse RSS feed
            response = await self._fetch_from_api(config)

            # Transform to standard format
            for job in response:
                jobs.append({
                    "source": self.source_name,
                    "source_job_id": job["id"],
                    "title": job["title"],
                    "company": job["company"],
                    "location": job.get("location"),
                    "url": job["url"],
                    "description": job.get("description", ""),
                    "posted_at": job.get("posted_at"),
                    "source_meta": {"raw": job}
                })

            logger.info(f"Fetched {len(jobs)} jobs from {self.source_name}")

        except Exception as e:
            logger.error(f"Error fetching jobs from {self.source_name}: {e}")

        return jobs

    async def _fetch_from_api(self, config: SearchConfig) -> list[dict]:
        """Helper method to fetch jobs from API."""
        # Implement your API call here
        # Use aiohttp for async HTTP requests
        import aiohttp

        async with aiohttp.ClientSession() as session:
            params = {
                "keywords": config.role_keywords,
                "location": config.locations[0] if config.locations else None,
            }

            async with session.get(
                "https://api.example.com/jobs",
                params=params
            ) as response:
                data = await response.json()
                return data.get("jobs", [])
```

### 2. Register Connector

Update `packages/core/src/huntarr_core/connectors/__init__.py`:

```python
from huntarr_core.connectors.brave_search import BraveSearchConnector
from huntarr_core.connectors.myconnector import MyConnector  # Add this
from huntarr_core.connectors.remoteok import RemoteOKConnector
from huntarr_core.connectors.weworkremotely import WeWorkRemotelyConnector

ALL_CONNECTORS = [
    RemoteOKConnector(),
    WeWorkRemotelyConnector(),
    BraveSearchConnector(),
    MyConnector(),  # Add this
]
```

### 3. Update Discovery Orchestrator

Optionally, update `packages/core/src/huntarr_core/connectors/discovery.py` to include connector-specific logic.

### 4. Test Connector

Create test in `tests/core/test_connectors.py`:

```python
import pytest
from huntarr_core.connectors.myconnector import MyConnector
from huntarr_core.types import SearchConfig

@pytest.mark.asyncio
async def test_myconnector():
    connector = MyConnector()
    config = SearchConfig(role_keywords=["python"])

    jobs = await connector.fetch_jobs(config)

    assert len(jobs) > 0
    assert all(job["source"] == "myconnector" for job in jobs)
    assert all("title" in job for job in jobs)
```

---

## Creating ATS Adapters

Add support for a new ATS (Application Tracking System).

### 1. Create Adapter Class

Create `packages/core/src/huntarr_core/browser/adapters/myats.py`:

```python
from __future__ import annotations

import logging
from typing import Any

from playwright.async_api import Page

from huntarr_core.browser.adapters.base import (
    AdapterResult,
    AtsAdapter,
)

logger = logging.getLogger(__name__)


class MyAtsAdapter(AtsAdapter):
    """Adapter for MyAts application forms."""

    def matches(self, url: str) -> bool:
        """Check if this adapter matches the URL."""
        return "myats.com" in url

    async def prefill(
        self,
        page: Page,
        profile: dict[str, Any],
        docs: dict[str, str],
    ) -> AdapterResult:
        """Fill out the application form."""
        result = AdapterResult(success=False, message="")

        try:
            # Wait for form to load
            await page.wait_for_selector("form", timeout=5000)

            # Fill name fields
            await self._fill_by_label(
                page,
                "First Name",
                profile.get("name", "").split()[0] if profile.get("name") else ""
            )
            await self._fill_by_label(
                page,
                "Last Name",
                " ".join(profile.get("name", "").split()[1:]) if profile.get("name") else ""
            )

            # Fill email
            await self._fill_by_label(page, "Email", profile.get("email", ""))

            # Fill phone
            await self._fill_by_label(page, "Phone", profile.get("phone", ""))

            # Fill location
            await self._fill_by_label(page, "Location", profile.get("location", ""))

            # Fill cover letter (if field exists)
            await self._fill_by_label(
                page,
                "Cover Letter",
                docs.get("cover_letter_text", "")
            )

            # Upload resume
            if "resume_path" in docs:
                await self._upload_file(
                    page,
                    "Resume",
                    docs["resume_path"]
                )

            result.success = True
            result.message = "Form filled successfully"

        except Exception as e:
            logger.error(f"Error filling MyAts form: {e}")
            result.success = False
            result.message = f"Error: {str(e)}"

        return result

    async def submit(self, page: Page) -> bool:
        """Submit the form."""
        try:
            # Find submit button
            submit_selectors = [
                "button[type='submit']",
                "button:has-text('Submit')",
                "button:has-text('Apply')",
                "input[type='submit']",
            ]

            for selector in submit_selectors:
                try:
                    await page.click(selector, timeout=3000)
                    return True
                except:
                    continue

            return False

        except Exception as e:
            logger.error(f"Error submitting MyAts form: {e}")
            return False

    async def extract_confirmation(self, page: Page) -> str | None:
        """Extract confirmation message."""
        try:
            # Look for success message
            selectors = [
                ".success-message",
                ".confirmation",
                "[class*='success']",
                "[class*='confirmation']",
            ]

            for selector in selectors:
                try:
                    element = await page.query_selector(selector)
                    if element:
                        return await element.text_content()
                except:
                    continue

            return None

        except Exception as e:
            logger.error(f"Error extracting confirmation: {e}")
            return None
```

### 2. Register Adapter

Update `packages/core/src/huntarr_core/browser/adapters/registry.py`:

```python
from huntarr_core.browser.adapters.fallback import FallbackAdapter
from huntarr_core.browser.adapters.greenhouse import GreenhouseAdapter
from huntarr_core.browser.adapters.lever import LeverAdapter
from huntarr_core.browser.adapters.myats import MyAtsAdapter  # Add this
from huntarr_core.browser.adapters.workday import WorkdayAdapter

ADAPTERS = [
    GreenhouseAdapter(),
    LeverAdapter(),
    WorkdayAdapter(),
    MyAtsAdapter(),  # Add this
    FallbackAdapter(),
]
```

### 3. Test Adapter

Create test in `tests/core/test_ats_adapters.py`:

```python
import pytest
from huntarr_core.browser.adapters.myats import MyAtsAdapter

def test_myats_adapter_matches():
    adapter = MyAtsAdapter()

    assert adapter.matches("https://acme.myats.com/jobs/123") is True
    assert adapter.matches("https://acme.greenhouse.io/jobs/123") is False
```

---

## Extending the Agent Graph

Add new nodes or modify the workflow.

### 1. Add New Node

In `packages/core/src/huntarr_core/agent/graph.py`:

```python
class HuntGraphRunner:
    def _build_graph(self):
        graph = StateGraph(HuntState)

        # Add existing nodes
        graph.add_node("load_profile_and_prefs", self.load_profile_and_prefs)
        graph.add_node("discover_jobs", self.discover_jobs_node)
        # ... other nodes ...

        # Add new node
        graph.add_node("my_custom_node", self.my_custom_node)

        # Connect nodes
        graph.add_edge(START, "load_profile_and_prefs")
        # ... other edges ...

        # Add conditional routing
        graph.add_conditional_edges(
            "my_custom_node",
            self.route_from_my_node,
            {
                "continue": "next_node",
                "skip": "alternative_node"
            }
        )

        return graph

    async def my_custom_node(self, state: HuntState) -> HuntState:
        """Custom node logic."""
        logger.info("Executing my_custom_node")

        # Your custom logic here
        result = await self._do_something(state)

        # Update state
        state["my_field"] = result

        # Emit event
        await self.repo.insert_run_event(
            state["run_id"],
            "info",
            "agent",
            "my_custom_node_complete",
            "Custom node completed",
            {"result": result}
        )

        return state

    def route_from_my_node(self, state: HuntState) -> str:
        """Route to next node based on state."""
        if state.get("should_continue"):
            return "continue"
        else:
            return "skip"
```

### 2. Modify Existing Node

Update node method to add new functionality:

```python
async def discover_jobs_node(self, state: HuntState) -> HuntState:
    """Discover jobs from all sources."""
    logger.info(f"Discovering jobs with config: {state['search_config']}")

    # Existing logic
    config = SearchConfig(**state["search_config"])
    jobs = await discover_jobs(config, self.repo)

    # Add custom logic
    jobs = self._filter_custom_logic(jobs)

    # Update state
    state["candidate_jobs"] = jobs
    state["metrics"]["jobs_discovered"] = len(jobs)

    return state

def _filter_custom_logic(self, jobs: list[dict]) -> list[dict]:
    """Custom job filtering logic."""
    # Your custom filtering here
    return [job for job in jobs if self._should_include(job)]
```

---

## Database Schema

### Schema File

Database schema is defined in `packages/core/src/huntarr_core/db/schema.sql`.

### Adding a New Table

```sql
-- Add new table
CREATE TABLE IF NOT EXISTS my_new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES run_sessions(id) ON DELETE CASCADE,
    field1 VARCHAR(255) NOT NULL,
    field2 TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index
CREATE INDEX idx_my_new_table_run_id ON my_new_table(run_id);
CREATE INDEX idx_my_new_table_created_at ON my_new_table(created_at DESC);
```

### Adding Repository Methods

In `packages/core/src/huntarr_core/db/repo.py`:

```python
class HuntRepo:
    # ... existing methods ...

    async def create_my_entity(
        self,
        run_id: str,
        field1: str,
        field2: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        """Create a new entity."""
        record = await self.fetchrow("""
            INSERT INTO my_new_table (run_id, field1, field2, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        """, run_id, field1, field2, metadata or {})

        return dict(record)

    async def get_my_entities(self, run_id: str) -> list[dict]:
        """Get all entities for a run."""
        rows = await self.fetch("""
            SELECT * FROM my_new_table
            WHERE run_id = $1
            ORDER BY created_at DESC
        """, run_id)

        return [dict(row) for row in rows]
```

### Migrations

For production, implement a migration system:

```bash
# Install Alembic
pip install alembic

# Initialize
alembic init migrations

# Configure alembic.ini and migrations/env.py

# Generate migration
alembic revision --autogenerate -m "Add my_new_table"

# Apply migration
alembic upgrade head
```

---

## API Development

### Adding a New Endpoint

In `apps/api/src/huntarr_api/main.py`:

```python
from fastapi import HTTPException

@app.post("/api/my-endpoint")
async def my_endpoint(payload: dict) -> dict:
    """My new endpoint."""
    repository = get_repo()

    try:
        # Your logic here
        result = await repository.create_something(payload)

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        logger.error(f"Error in my_endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Adding Pydantic Schema

In `apps/api/src/huntarr_api/schemas.py`:

```python
from pydantic import BaseModel, Field

class MyPayload(BaseModel):
    field1: str = Field(..., description="Field 1 description")
    field2: int | None = Field(None, description="Field 2 description")
    metadata: dict = Field(default_factory=dict, description="Metadata")

class MyResponse(BaseModel):
    id: str
    field1: str
    field2: int | None
    created_at: datetime
```

### Using the Schema

```python
@app.post("/api/my-endpoint", response_model=MyResponse)
async def my_endpoint(payload: MyPayload) -> MyResponse:
    repository = get_repo()

    result = await repository.create_my_entity(
        field1=payload.field1,
        field2=payload.field2,
        metadata=payload.metadata
    )

    return MyResponse(**result)
```

---

## Frontend Development

### Adding a New Page

1. Create page component in `apps/frontend/src/pages/MyPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function MyPage() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const result = await api.getMyData();
    setData(result);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My Page</h1>
      <div>
        {data.map((item) => (
          <div key={item.id} className="p-4 border mb-2">
            {item.field1}
          </div>
        ))}
      </div>
    </div>
  );
}
```

2. Add API client method in `apps/frontend/src/lib/api.ts`:

```typescript
const api = {
  // ... existing methods ...

  async getMyData() {
    const response = await fetch('/api/my-endpoint');
    return response.json();
  }
};
```

3. Add route in `apps/frontend/src/App.tsx`:

```tsx
import MyPage from './pages/MyPage';

// In routes section
<Route path="/my-page" element={<MyPage />} />
```

### Adding a Component

Create `apps/frontend/src/components/MyComponent.tsx`:

```tsx
interface MyComponentProps {
  title: string;
  onClick?: () => void;
}

export default function MyComponent({ title, onClick }: MyComponentProps) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      {title}
    </button>
  );
}
```

---

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/core/test_ranking.py

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=huntarr_core
```

### Writing Tests

#### Unit Test Example

```python
import pytest
from huntarr_core.ranking import score_job
from huntarr_core.types import JobPosting

@pytest.mark.asyncio
async def test_job_scoring():
    job = JobPosting(
        source="test",
        source_job_id="123",
        title="Python Developer",
        company="Acme Corp",
        location="Remote",
        url="https://example.com/job/123",
        description="Looking for Python developer",
        dedupe_hash="abc123"
    )

    profile = {
        "skills": ["Python", "JavaScript"],
        "search_preferences": {
            "role_keywords": ["python developer"],
            "locations": ["Remote"],
            "remote_only": True
        }
    }

    score = score_job(job, profile)

    assert score > 50  # Should match well
```

#### Integration Test Example

```python
import pytest
from huntarr_core.db.repo import HuntRepo
from huntarr_core.types import SearchConfig

@pytest.mark.asyncio
async def test_create_and_fetch_job(repo: HuntRepo):
    config = SearchConfig(
        role_keywords=["python"],
        max_jobs_per_run=10
    )

    run = await repo.create_run("discovery", config.dict())

    assert run["id"] is not None
    assert run["mode"] == "discovery"

    fetched = await repo.get_run(run["id"])

    assert fetched["id"] == run["id"]
```

#### E2E Test Example (Playwright)

```python
import pytest
from playwright.async_api import async_playwright

@pytest.mark.asyncio
async def test_job_application_flow():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to application form
        await page.goto("https://acme.greenhouse.io/jobs/123")

        # Fill form
        await page.fill("input[name='first_name']", "John")
        await page.fill("input[name='last_name']", "Doe")
        await page.fill("input[name='email']", "john@example.com")

        # Submit
        await page.click("button[type='submit']")

        # Verify
        assert await page.is_visible(".success-message")

        await browser.close()
```

### Fixtures

Create `tests/conftest.py`:

```python
import pytest
from huntarr_core.db.pool import create_db_pool, init_db_schema
from huntarr_core.db.repo import HuntRepo

@pytest.fixture
async def db_pool():
    pool = await create_db_pool("postgresql+asyncpg://test:test@localhost:5432/test")
    await init_db_schema(pool)
    yield pool
    await pool.close()

@pytest.fixture
async def repo(db_pool):
    return HuntRepo(db_pool)
```

---

## Code Style

### Python

- Use `black` for formatting:

```bash
pip install black
black packages/ apps/
```

- Use `ruff` for linting:

```bash
pip install ruff
ruff check packages/ apps/
```

- Use `mypy` for type checking:

```bash
pip install mypy
mypy packages/core/src/huntarr_core/
```

### JavaScript/TypeScript

- Use `eslint`:

```bash
cd apps/frontend
npm run lint
```

- Use `prettier`:

```bash
npm run format
```

### Git Hooks

Set up pre-commit hooks:

```bash
pip install pre-commit
pre-commit install
```

Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.12.1
    hooks:
      - id: black
        language_version: python3.10

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.9
    hooks:
      - id: ruff
        args: [--fix]

  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
```

---

## Deployment

### Building Docker Images

```bash
# Build all services
docker compose -f infra/docker/docker-compose.yml build

# Build specific service
docker compose -f infra/docker/docker-compose.yml build worker
```

### Environment-Specific Configurations

Create `.env.production`:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/huntarr
VAULT_MASTER_PASSPHRASE=${VAULT_MASTER_PASSPHRASE}
BRAVE_API_KEY=${BRAVE_API_KEY}
BROWSER_HEADLESS=true
CORS_ORIGINS=https://huntarr.yourdomain.com
```

### Production Considerations

1. **Security**:
   - Use strong `VAULT_MASTER_PASSPHRASE`
   - Enable HTTPS
   - Implement authentication
   - Restrict CORS origins

2. **Performance**:
   - Scale worker instances
   - Add database indexes
   - Use connection pooling
   - Enable caching

3. **Monitoring**:
   - Add logging aggregation
   - Monitor queue backlog
   - Track application success rate
   - Alert on errors

4. **Backups**:
   - Regular database backups
   - Backup credential vault
   - Backup uploaded files

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Write tests
5. Run tests: `pytest`
6. Format code: `black . && ruff check --fix .`
7. Commit changes: `git commit -m "Add my feature"`
8. Push to branch: `git push origin feature/my-feature`
9. Open a pull request

---

For more information, see:
- [Quick Start](QUICKSTART.md)
- [User Guide](USER_GUIDE.md)
- [API Reference](API_REFERENCE.md)
- [Architecture](ARCHITECTURE.md)
- [Configuration](CONFIGURATION.md)
- [Troubleshooting](TROUBLESHOOTING.md)
