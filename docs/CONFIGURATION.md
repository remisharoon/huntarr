---
title: Configuration - Huntarr
description: Complete reference for configuring Huntarr. Environment variables, database settings, profile configuration, and system configuration.
keywords: configuration, environment variables, settings, database, profile configuration
robots: index, follow
og:title: Configuration - Huntarr
og:description: Complete reference for configuring Huntarr.
og:type: website
og:url: https://remisharoon.github.io/huntarr/CONFIGURATION/
twitter:card: summary
twitter:title: Configuration - Huntarr
twitter:description: Complete reference for configuring Huntarr.
---

# Configuration

Complete reference for configuring Huntarr.

## Environment Variables

Configure Huntarr using environment variables in `.env` file.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql+asyncpg://huntarr:huntarr@postgres:5432/huntarr` |
| `VAULT_MASTER_PASSPHRASE` | Master passphrase for credential encryption | `your-secure-random-passphrase` |

**⚠️ Important**: `VAULT_MASTER_PASSPHRASE` is critical for credential security. If lost, all stored credentials will be permanently unrecoverable.

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BRAVE_API_KEY` | Brave Search API key for job discovery | `null` |
| `PLAYWRIGHT_VNC_URL` | noVNC browser session URL | `http://localhost:7900` |
| `BROWSER_HEADLESS` | Run browser in headless mode (no UI) | `true` |
| `AUTO_SUBMIT_ENABLED` | Automatically submit applications | `true` |
| `CORS_ORIGINS` | CORS allowed origins | `*` |

### Example `.env` File

```bash
# Database
DATABASE_URL=postgresql+asyncpg://huntarr:huntarr@postgres:5432/huntarr

# Credential Vault (REQUIRED - generate a secure random string)
VAULT_MASTER_PASSPHRASE=change-this-to-a-secure-random-passphrase

# Job Discovery
BRAVE_API_KEY=your-brave-api-key-here

# Browser Automation
PLAYWRIGHT_VNC_URL=http://localhost:7900
BROWSER_HEADLESS=true
AUTO_SUBMIT_ENABLED=true

# CORS
CORS_ORIGINS=*
```

---

## Database Configuration

### Connection String Format

```bash
postgresql+asyncpg://[user]:[password]@[host]:[port]/[database]
```

### Connection Pool Settings

The connection pool is configured in `packages/core/src/huntarr_core/db/pool.py`:

```python
min_size=10,
max_size=10,
max_queries=50000,
max_inactive_connection_lifetime=300.0,
```

### Schema Initialization

Database schema is automatically initialized on API startup from `packages/core/src/huntarr_core/db/schema.sql`.

### Migrations

Currently, there is no formal migration system. For schema changes:
1. Update `schema.sql`
2. Drop and recreate database (development only)
3. For production, implement migration system (Alembic recommended)

---

## Profile Configuration

Profile configuration is stored in the `profiles` table and managed via API.

### Search Preferences

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `role_keywords` | string[] | `[]` | Keywords to match in job title/description |
| `exclude_keywords` | string[] | `[]` | Keywords to exclude |
| `locations` | string[] | `["GCC", "Remote"]` | Target locations |
| `remote_only` | boolean | `false` | Only show remote jobs |
| `salary_min` | integer | `null` | Minimum annual salary |
| `salary_max` | integer | `null` | Maximum annual salary |
| `aggressive_scraping` | boolean | `true` | Use Brave Search API |
| `max_jobs_per_run` | integer | `50` | Maximum jobs per discovery run |
| `natural_language_override` | string | `null` | Natural language description of ideal job |

### Example Search Preferences

```json
{
  "search_preferences": {
    "role_keywords": ["backend developer", "software engineer", "python developer"],
    "exclude_keywords": ["senior manager", "tech lead", "vp", "director"],
    "locations": ["Remote", "San Francisco", "New York"],
    "remote_only": true,
    "salary_min": 120000,
    "salary_max": 200000,
    "aggressive_scraping": true,
    "max_jobs_per_run": 30,
    "natural_language_override": "Looking for backend roles using Python and PostgreSQL, preferably remote"
  }
}
```

---

## System Configuration

System configuration is stored in the `configs` table and can be updated via API.

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auto_submit_enabled` | boolean | `true` | Automatically submit applications |
| `browser_headless` | boolean | `true` | Run browser in headless mode |
| `queue_poll_interval` | integer | `2` | Worker queue poll interval (seconds) |
| `max_retry_attempts` | integer | `3` | Maximum retry attempts for failed jobs |

### Update System Config

```bash
curl -X PUT http://localhost:8000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "auto_submit_enabled": false,
    "browser_headless": false
  }'
```

---

## Worker Configuration

### Queue Polling

Worker polls the job queue every `queue_poll_interval` seconds (default: 2).

### Schedule Processing

Worker checks for due schedules every poll cycle (every 2 seconds).

### Retry Strategy

Failed jobs are retried with exponential backoff:

```
delay = base_seconds * 2^(attempt - 1)
```

Where `base_seconds = 5` and `max_retry_attempts = 3`.

| Attempt | Delay |
|---------|-------|
| 1 | 5 seconds |
| 2 | 10 seconds |
| 3 | 20 seconds |
| 4 | Failed (max retries exceeded) |

---

## Browser Configuration

### Headless Mode

When `BROWSER_HEADLESS=true`, browser runs without UI. Set to `false` for debugging.

```bash
BROWSER_HEADLESS=false
```

### User Agent

Browser uses randomized user agents for human-like behavior.

### Delays

Random delays between actions (0.9-1.8 seconds) to avoid detection.

### Screenshots

Screenshots are saved to `/data/artifacts`:
- `landing.png` - First view of application page
- `postfill.png` - After form filling
- `result.png` - After submission

---

## API Configuration

### CORS

CORS is configured in `apps/api/src/huntarr_api/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)
```

Configure via `CORS_ORIGINS` environment variable.

### SSE Events

Server-Sent Events are polled every 1 second for new events.

### File Upload Limits

Resume upload limit: 5 MB

---

## Docker Compose Configuration

### Services

| Service | Port | Description |
|---------|------|-------------|
| `frontend` | 5173 | React UI |
| `api` | 8000 | FastAPI backend |
| `worker` | - | LangGraph worker (internal) |
| `postgres` | 5432 | PostgreSQL database |
| `playwright-vnc` | 7900 | noVNC browser session |

### Volumes

| Volume | Path | Description |
|--------|------|-------------|
| `artifacts_data` | `/data/artifacts` | Screenshots and generated documents |
| `uploads_data` | `/data/uploads` | Uploaded resumes |
| `browser_session_data` | `/browser_data` | Playwright browser state |
| `postgres_data_v2` | `/var/lib/postgresql/data` | PostgreSQL data |

### Resource Limits

Configure in `infra/docker/docker-compose.yml`:

```yaml
services:
  worker:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### Environment Overrides

Override service environments:

```yaml
services:
  worker:
    environment:
      - BRAVE_API_KEY=${BRAVE_API_KEY}
```

---

## Credential Vault Configuration

### Encryption

Credentials are encrypted using:
- Algorithm: AES-GCM
- Key Derivation: PBKDF2 (390k iterations)
- Salt: Random per-credential

### Security Best Practices

1. **Generate Strong Passphrase**: Use a cryptographically secure random string
2. **Store Securely**: Keep passphrase in secure vault (not in git)
3. **Never Share**: Don't share passphrase or export it
4. **Backup**: Back up encrypted credentials separately

### Example: Generate Secure Passphrase

```bash
# Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Using OpenSSL
openssl rand -base64 32

# Using urandom (Linux/Mac)
head -c 32 /dev/urandom | base64
```

---

## Job Discovery Configuration

### Connectors

| Connector | API Key Required | Source |
|-----------|------------------|--------|
| RemoteOK | No | https://remoteok.com/api |
| WeWorkRemotely | No | https://weworkremotely.com/remote-jobs.rss |
| Brave Search | Yes | https://api.search.brave.com/res/v1/web/search |

### Brave Search API

1. Get API key from https://brave.com/search/api/
2. Set `BRAVE_API_KEY` in `.env`
3. Huntarr searches for ATS domains (lever.co, greenhouse.io, workday.com)

### Robots.txt Compliance

Job discovery respects `robots.txt` via `robots_allows()` function in `connectors/policies.py`.

### Platform Policies

Restricted platforms (login flows blocked):
- `linkedin.com`
- `indeed.com`
- `glassdoor.com`

Allowed (company ATS accounts):
- `*.greenhouse.io`
- `*.lever.co`
- `*.myworkdayjobs.com`
- `*.workday.com`

---

## Ranking Algorithm Configuration

### Score Components

| Component | Weight | Description |
|-----------|--------|-------------|
| Keyword Match | 40% | Match `role_keywords` |
| Location Match | 30% | Match location preferences |
| Skills Match | 20% | Match profile skills |
| Natural Language | 10% | Semantic similarity (if `natural_language_override` set) |

### Threshold

Jobs below score threshold (default: 50) are filtered out.

---

## ATS Adapter Configuration

### Supported ATS

| ATS | Domain Pattern | Adapter |
|-----|----------------|---------|
| Greenhouse | `*.greenhouse.io` | `greenhouse.py` |
| Lever | `*.lever.co` | `lever.py` |
| Workday | `*.myworkdayjobs.com`, `*.workday.com` | `workday.py` |
| Generic | All others | `fallback.py` |

### Adapter Registry

Adapters are registered in `packages/core/src/huntarr_core/browser/adapters/registry.py`.

Add new adapters by:
1. Creating adapter class in `adapters/` directory
2. Implementing base class methods
3. Registering in `ADAPTERS` list

---

## Logging Configuration

### Log Levels

| Level | Description |
|-------|-------------|
| DEBUG | Detailed debugging information |
| INFO | General informational messages |
| WARNING | Warning messages |
| ERROR | Error messages |
| CRITICAL | Critical errors |

### Configure Log Level

Set in `.env`:

```bash
LOG_LEVEL=INFO
```

---

## Performance Tuning

### Database

Increase connection pool for high concurrency:

```python
# In packages/core/src/huntarr_core/db/pool.py
min_size=20,
max_size=20,
```

### Worker

Scale worker instances:

```yaml
# In docker-compose.yml
services:
  worker:
    deploy:
      replicas: 3
```

### Queue Processing

Adjust queue poll interval:

```bash
QUEUE_POLL_INTERVAL=1
```

---

## Development vs Production

### Development

```bash
BROWSER_HEADLESS=false
LOG_LEVEL=DEBUG
CORS_ORIGINS=*
```

### Production

```bash
BROWSER_HEADLESS=true
LOG_LEVEL=INFO
CORS_ORIGINS=https://yourdomain.com
VAULT_MASTER_PASSPHRASE=<secure-generated-passphrase>
```

---

## Troubleshooting Configuration Issues

### Database Connection Failed

**Symptoms**: API health check fails, database errors

**Solutions**:
1. Check `DATABASE_URL` is correct
2. Ensure PostgreSQL is running
3. Verify database exists

### Vault Passphrase Not Set

**Symptoms**: "Vault passphrase not set" error

**Solutions**:
1. Set `VAULT_MASTER_PASSPHRASE` in `.env`
2. Restart services: `docker compose restart api worker`

### Brave Search Not Working

**Symptoms**: No jobs from Brave Search, API errors

**Solutions**:
1. Set `BRAVE_API_KEY` in `.env`
2. Get API key from https://brave.com/search/api/
3. Restart worker: `docker compose restart worker`

### noVNC Not Accessible

**Symptoms**: Can't access http://localhost:7900

**Solutions**:
1. Check `playwright-vnc` service is running
2. Verify `PLAYWRIGHT_VNC_URL` in `.env`
3. Check browser logs: `docker compose logs playwright-vnc`

---

For more information, see:
- [Quick Start](QUICKSTART.md)
- [User Guide](USER_GUIDE.md)
- [API Reference](API_REFERENCE.md)
- [Troubleshooting](TROUBLESHOOTING.md)
