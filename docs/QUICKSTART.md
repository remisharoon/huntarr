# Quick Start Guide

Get Huntarr up and running in 5 minutes.

## Prerequisites

- **Docker** (20.10+)
- **Docker Compose** (2.0+)

Verify installation:

```bash
docker --version
docker compose version
```

## Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd huntarr
```

### 2. Configure Environment

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` and configure at minimum:

```bash
# Database URL (default works for Docker Compose)
DATABASE_URL=postgresql+asyncpg://huntarr:huntarr@postgres:5432/huntarr

# Master passphrase for credential vault ( REQUIRED - generate a secure random string )
VAULT_MASTER_PASSPHRASE=your-secure-random-passphrase-here

# Brave API key (optional but recommended for job discovery)
BRAVE_API_KEY=your-brave-api-key-here
```

**Important**: Set a strong `VAULT_MASTER_PASSPHRASE` - this encrypts your stored credentials.

### 3. Start Services

Build and start all services:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

This will start:
- Frontend (React UI) on port 5173
- API (FastAPI) on port 8000
- Worker (LangGraph) - internal
- PostgreSQL on port 5432
- noVNC (manual intervention) on port 7900

### 4. Verify Installation

Open these URLs in your browser:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API Docs | http://localhost:8000/docs |
| noVNC | http://localhost:7900 |

**API Health Check**:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "database_time": "2024-01-15T10:30:00Z"
}
```

## First Run

### 1. Create Your Profile

Navigate to http://localhost:5173 and go to the **Profile** page.

Fill in your profile:

```json
{
  "name": "Your Name",
  "email": "your.email@example.com",
  "phone": "+1234567890",
  "location": "Remote",
  "skills": [
    "Python",
    "React",
    "Docker",
    "PostgreSQL"
  ],
  "experience": [
    {
      "company": "Previous Company",
      "title": "Senior Developer",
      "start_date": "2020-01-01",
      "end_date": "2024-01-01",
      "description": "Built scalable web applications"
    }
  ],
  "education": [
    {
      "school": "University",
      "degree": "BS Computer Science",
      "graduation_date": "2019-05-01"
    }
  ],
  "search_preferences": {
    "role_keywords": ["backend developer", "software engineer"],
    "exclude_keywords": ["senior manager", "lead"],
    "locations": ["Remote", "San Francisco", "New York"],
    "remote_only": true,
    "salary_min": 100000,
    "salary_max": 200000,
    "max_jobs_per_run": 20
  }
}
```

### 2. Upload Your Resume

On the Profile page:

1. Click **Upload Resume**
2. Select your resume PDF
3. Click **Parse Resume** to extract and validate the content

This will populate your profile with skills and experience from your resume.

### 3. Run Your First Job Hunt

Go to the **Runs** page and click **New Run**.

Configure the run:

```json
{
  "mode": "discovery",
  "search_config": {
    "role_keywords": ["backend developer", "software engineer"],
    "locations": ["Remote"],
    "remote_only": true,
    "max_jobs_per_run": 10
  }
}
```

Click **Start Run** to begin job discovery and ranking.

### 4. View Discovered Jobs

Go to the **Jobs** page to see discovered jobs.

Each job shows:
- Title and company
- Location and source
- Relevance score
- **Apply Now** button

### 5. Apply to a Job (Manual)

Find a job you want to apply to and click **Apply Now**.

This will:
1. Create a run for this specific job
2. Generate your resume PDF and cover letter
3. Open the application form
4. Fill out the form automatically
5. Submit the application (if no CAPTCHA)

Monitor progress on the **Runs** page or check the **Applications** page.

## Using Apply-Now Flow

For quick, targeted applications:

1. Go to **Jobs** page
2. Find a job
3. Click **Apply Now**
4. Watch real-time progress via SSE events
5. Handle any manual actions (CAPTCHAs) if needed

### Example: Apply to a Specific Job

Using the API:

```bash
# Get job ID from Jobs page
JOB_ID="<job-uuid>"

# Apply now
curl -X POST http://localhost:8000/api/jobs/$JOB_ID/apply-now \
  -H "Content-Type: application/json" \
  -d '{}'

# Monitor run events
curl -N http://localhost:8000/api/runs/<run-uuid>/events
```

## Setting Up Scheduled Runs

Automate job hunting on a schedule:

1. Go to **Schedules** page
2. Click **New Schedule**
3. Configure:

```json
{
  "name": "Morning Job Hunt",
  "cron_expr": "0 9 * * 1-5",
  "timezone": "America/Los_Angeles",
  "enabled": true,
  "payload": {
    "search_config": {
      "role_keywords": ["backend developer"],
      "locations": ["Remote"],
      "remote_only": true,
      "max_jobs_per_run": 20
    }
  }
}
```

4. Click **Create**

This will run automatically at 9 AM PST on weekdays.

### Cron Expression Examples

| Expression | Schedule |
|------------|----------|
| `0 9 * * 1-5` | 9 AM every weekday |
| `0 */4 * * *` | Every 4 hours |
| `0 0 * * 0` | Midnight every Sunday |
| `0 9,18 * * *` | 9 AM and 6 PM daily |

## Handling Manual Interventions

When Huntarr detects a CAPTCHA or challenge, it will:

1. Pause the run
2. Create a manual action
3. Display it on the **Manual Queue** page

### Resolve a Manual Action

1. Go to **Manual Queue** page
2. Find the pending action
3. Click **Start Session** - this opens noVNC in a new tab
4. Manually resolve the CAPTCHA/challenge in the browser
5. Return to Huntarr and click **Resolve**
6. The run will resume automatically

### noVNC Session

- URL: http://localhost:7900
- Automatically started when you click **Start Session**
- Allows you to interact with the browser session
- Close the tab when done

## Stopping Services

Stop all services:

```bash
docker compose -f infra/docker/docker-compose.yml down
```

To remove volumes (WARNING: deletes data):

```bash
docker compose -f infra/docker/docker-compose.yml down -v
```

## View Logs

View logs from all services:

```bash
docker compose -f infra/docker/docker-compose.yml logs -f
```

View specific service logs:

```bash
docker compose -f infra/docker/docker-compose.yml logs -f api
docker compose -f infra/docker/docker-compose.yml logs -f worker
docker compose -f infra/docker/docker-compose.yml logs -f frontend
```

## Next Steps

- 📖 Read the [User Guide](USER_GUIDE.md) for detailed features
- 🏗️ Learn about the [Architecture](ARCHITECTURE.md)
- 📚 Explore the [API Reference](API_REFERENCE.md)
- ⚙️ Configure [Settings](CONFIGURATION.md)
- 🐛 Check [Troubleshooting](TROUBLESHOOTING.md) for issues

## Common First-Time Issues

### Issue: Database connection failed

**Solution**: Ensure PostgreSQL is running:

```bash
docker compose -f infra/docker/docker-compose.yml logs postgres
```

### Issue: "Vault passphrase not set"

**Solution**: Set `VAULT_MASTER_PASSPHRASE` in `.env` and restart:

```bash
docker compose -f infra/docker/docker-compose.yml restart api worker
```

### Issue: Jobs not being discovered

**Solution**: Check that `BRAVE_API_KEY` is set or try with just RemoteOK/WeWorkRemotely:

```bash
# In .env
BRAVE_API_KEY=
```

### Issue: Manual session not opening

**Solution**: Ensure noVNC is running:

```bash
docker compose -f infra/docker/docker-compose.yml logs playwright-vnc
```

Access directly: http://localhost:7900

## Need Help?

- Check [Troubleshooting](TROUBLESHOOTING.md) for common issues
- Review [Configuration](CONFIGURATION.md) for settings
- See [Developer Guide](DEVELOPER_GUIDE.md) for advanced usage
