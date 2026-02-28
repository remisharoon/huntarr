# Troubleshooting

Common issues and solutions for Huntarr.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Database Issues](#database-issues)
3. [Queue & Worker Issues](#queue--worker-issues)
4. [Browser Automation Issues](#browser-automation-issues)
5. [Manual Action Issues](#manual-action-issues)
6. [ATS-Specific Issues](#ats-specific-issues)
7. [Performance Issues](#performance-issues)
8. [Network Issues](#network-issues)

---

## Installation Issues

### Docker Build Fails

**Symptoms**: `docker compose up --build` fails with build errors

**Solutions**:

1. Check Docker and Docker Compose versions:

```bash
docker --version
docker compose version
```

2. Ensure you have enough disk space:

```bash
df -h
```

3. Clear Docker cache and rebuild:

```bash
docker compose down
docker system prune -a
docker compose -f infra/docker/docker-compose.yml up --build
```

4. Check for port conflicts:

```bash
lsof -i :5173
lsof -i :8000
lsof -i :5432
lsof -i :7900
```

Kill conflicting processes or change ports in `docker-compose.yml`.

### Services Won't Start

**Symptoms**: Services exit immediately or won't start

**Solutions**:

1. Check service logs:

```bash
docker compose logs api
docker compose logs worker
docker compose logs postgres
```

2. Check environment variables:

```bash
docker compose config
```

3. Verify `.env` file exists and is correctly formatted:

```bash
cat .env
```

4. Restart services:

```bash
docker compose restart
```

### Frontend Not Accessible

**Symptoms**: Can't access http://localhost:5173

**Solutions**:

1. Check frontend service status:

```bash
docker compose ps frontend
```

2. View frontend logs:

```bash
docker compose logs frontend
```

3. Ensure port 5173 is not in use:

```bash
lsof -i :5173
```

4. Rebuild frontend:

```bash
docker compose up --build frontend
```

---

## Database Issues

### Database Connection Failed

**Symptoms**: API health check fails, connection errors

**Solutions**:

1. Check PostgreSQL is running:

```bash
docker compose ps postgres
```

2. View PostgreSQL logs:

```bash
docker compose logs postgres
```

3. Verify `DATABASE_URL` in `.env`:

```bash
grep DATABASE_URL .env
```

Format: `postgresql+asyncpg://huntarr:huntarr@postgres:5432/huntarr`

4. Restart PostgreSQL and API:

```bash
docker compose restart postgres
docker compose restart api
```

5. Test connection manually:

```bash
docker compose exec postgres psql -U huntarr -d huntarr -c "SELECT 1;"
```

### Schema Initialization Failed

**Symptoms**: "relation does not exist" errors

**Solutions**:

1. Check if schema file exists:

```bash
ls -la packages/core/src/huntarr_core/db/schema.sql
```

2. Drop and recreate database (development only):

```bash
docker compose exec postgres psql -U huntarr -d postgres -c "DROP DATABASE IF EXISTS huntarr;"
docker compose exec postgres psql -U huntarr -d postgres -c "CREATE DATABASE huntarr;"
docker compose restart api
```

3. View API startup logs:

```bash
docker compose logs api | grep -i schema
```

### Database Migration Issues

**Symptoms**: After code updates, schema is out of sync

**Solutions**:

1. For development: Drop and recreate database (see above)

2. For production: Implement migration system (Alembic recommended):

```bash
# Install Alembic
pip install alembic

# Initialize
alembic init migrations

# Generate migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head
```

### Slow Database Queries

**Symptoms**: API responses are slow, high database latency

**Solutions**:

1. Check indexes exist:

```bash
docker compose exec postgres psql -U huntarr -d huntarr -c "\d job_postings"
```

2. Analyze slow queries:

```bash
docker compose exec postgres psql -U huntarr -d huntarr -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

3. Add missing indexes to `schema.sql`

4. Increase connection pool size (see [Configuration](CONFIGURATION.md))

---

## Queue & Worker Issues

### Jobs Not Processing

**Symptoms**: Jobs stuck in `queued` status

**Solutions**:

1. Check worker is running:

```bash
docker compose ps worker
```

2. View worker logs:

```bash
docker compose logs -f worker
```

3. Check queue table:

```bash
docker compose exec postgres psql -U huntarr -d huntarr -c "SELECT * FROM job_queue WHERE status = 'pending' LIMIT 5;"
```

4. Restart worker:

```bash
docker compose restart worker
```

5. Check worker configuration:

```bash
docker compose exec worker env | grep QUEUE
```

### Queue Polling Issues

**Symptoms**: Worker not claiming jobs frequently

**Solutions**:

1. Check `QUEUE_POLL_INTERVAL` in `.env`

2. Adjust polling interval:

```bash
QUEUE_POLL_INTERVAL=1
```

3. Restart worker:

```bash
docker compose restart worker
```

### Job Retries Exhausted

**Symptoms**: Jobs failing after max retries

**Solutions**:

1. Increase `max_retry_attempts` in system config:

```bash
curl -X PUT http://localhost:8000/api/config \
  -H "Content-Type: application/json" \
  -d '{"max_retry_attempts": 5}'
```

2. Re-queue failed jobs manually:

```bash
docker compose exec postgres psql -U huntarr -d huntarr -c "UPDATE job_queue SET status = 'pending', attempts = 0 WHERE status = 'failed';"
```

3. Restart worker:

```bash
docker compose restart worker
```

### Worker Crashes

**Symptoms**: Worker exits unexpectedly

**Solutions**:

1. View worker logs for errors:

```bash
docker compose logs worker | tail -100
```

2. Check worker health:

```bash
docker compose ps worker
```

3. Restart worker:

```bash
docker compose restart worker
```

4. If crashes persist, check for:
   - Memory issues
   - LangGraph graph errors
   - Database connection issues

---

## Browser Automation Issues

### Playwright Installation Failed

**Symptoms**: "playwright not found" errors

**Solutions**:

1. Rebuild worker image:

```bash
docker compose up --build worker
```

2. Install Playwright browsers:

```bash
docker compose exec worker playwright install chromium
```

3. Check Playwright version:

```bash
docker compose exec worker python -c "import playwright; print(playwright.__version__)"
```

### Browser Won't Launch

**Symptoms**: "Browser not launched" errors

**Solutions**:

1. Check if browser headless mode is correctly set:

```bash
grep BROWSER_HEADLESS .env
```

2. Set to `false` for debugging:

```bash
BROWSER_HEADLESS=false
```

3. Restart worker:

```bash
docker compose restart worker
```

4. Check browser logs:

```bash
docker compose logs worker | grep -i browser
```

### Form Filling Failed

**Symptoms**: "Form not found" or "Field not found" errors

**Solutions**:

1. Check if URL matches a known ATS adapter:

```bash
# Get job URL
curl http://localhost:8000/api/jobs/<job-id>

# Check which adapter should match
```

2. View screenshots in `/data/artifacts`:

```bash
ls -la /data/artifacts
```

3. If form structure changed:
   - ATS may have updated their form
   - Fallback adapter may be used
   - Update adapter in `packages/core/src/huntarr_core/browser/adapters/`

4. Try with `BROWSER_HEADLESS=false` to debug:

```bash
BROWSER_HEADLESS=false
docker compose restart worker
```

### CAPTCHA Detection Issues

**Symptoms**: CAPTCHA not detected or false positives

**Solutions**:

1. Check CAPTCHA detection logic in `packages/core/src/huntarr_core/browser/engine.py`

2. View screenshots for false positives:

```bash
ls -la /data/artifacts/*captcha*
```

3. Adjust CAPTCHA selectors if needed

---

## Manual Action Issues

### Manual Session Won't Start

**Symptoms**: "Start Session" button doesn't open noVNC

**Solutions**:

1. Check noVNC is running:

```bash
docker compose ps playwright-vnc
```

2. View noVNC logs:

```bash
docker compose logs playwright-vnc
```

3. Verify `PLAYWRIGHT_VNC_URL` in `.env`:

```bash
grep PLAYWRIGHT_VNC_URL .env
```

4. Access noVNC directly: http://localhost:7900

5. Restart playwright-vnc:

```bash
docker compose restart playwright-vnc
```

### Manual Action Stuck in Pending

**Symptoms**: Manual action stays in `pending` status

**Solutions**:

1. Check manual action details:

```bash
docker compose exec postgres psql -U huntarr -d huntarr -c "SELECT * FROM manual_actions WHERE status = 'pending';"
```

2. Ensure worker is running (worker detects and pauses runs):

```bash
docker compose ps worker
```

3. Restart worker:

```bash
docker compose restart worker
```

### Manual Action Can't Be Resolved

**Symptoms**: "Resolve" button doesn't work, status doesn't change

**Solutions**:

1. Check API logs:

```bash
docker compose logs api | grep -i manual
```

2. Verify manual action ID:

```bash
curl http://localhost:8000/api/manual-actions
```

3. Try resolving via API:

```bash
curl -X POST http://localhost:8000/api/manual-actions/<action-id>/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolution": "manual", "notes": "Resolved manually"}'
```

4. If still failing, manually update database (development only):

```bash
docker compose exec postgres psql -U huntarr -d huntarr -c "UPDATE manual_actions SET status = 'resolved' WHERE id = '<action-id>';"
```

### Run Won't Resume After Manual Action

**Symptoms**: Run stays paused after resolving manual action

**Solutions**:

1. Check run status:

```bash
curl http://localhost:8000/api/runs/<run-id>
```

2. Ensure worker is running:

```bash
docker compose ps worker
```

3. Manually resume run:

```bash
curl -X POST http://localhost:8000/api/runs/<run-id>/resume
```

4. Check worker logs:

```bash
docker compose logs -f worker
```

---

## ATS-Specific Issues

### Greenhouse Forms Not Filling

**Symptoms**: Greenhouse application forms not being filled

**Solutions**:

1. Check Greenhouse adapter in `packages/core/src/huntarr_core/browser/adapters/greenhouse.py`

2. Verify URL matches Greenhouse pattern:

```bash
# Should match: *.greenhouse.io
```

3. View postfill screenshot:

```bash
ls -la /data/artifacts/*postfill*
```

4. Check form fields have correct selectors:

   - First name: `input[name='first_name']`
   - Last name: `input[name='last_name']`
   - Email: `input[name='email']`
   - Phone: `input[name='phone']`
   - Cover letter: `textarea[name='cover_letter']`

5. If selectors changed, update adapter

### Lever Forms Not Filling

**Symptoms**: Lever application forms not being filled

**Solutions**:

1. Check Lever adapter in `packages/core/src/huntarr_core/browser/adapters/lever.py`

2. Verify URL matches Lever pattern:

```bash
# Should match: *.lever.co
```

3. Check for `data-qa` attributes (Lever uses these for selectors)

4. View postfill screenshot:

```bash
ls -la /data/artifacts/*postfill*
```

5. If selectors changed, update adapter

### Workday Forms Not Filling

**Symptoms**: Workday application forms not being filled

**Solutions**:

1. Check Workday adapter in `packages/core/src/huntarr_core/browser/adapters/workday.py`

2. Verify URL matches Workday pattern:

```bash
# Should match: *.myworkdayjobs.com or *.workday.com
```

3. Check for `data-automation-id` attributes

4. Workday uses multi-step forms - ensure "Next" button is clicked

5. View postfill screenshot:

```bash
ls -la /data/artifacts/*postfill*
```

6. If selectors changed, update adapter

### Fallback Adapter Issues

**Symptoms**: Generic adapter not filling unknown forms

**Solutions**:

1. Fallback adapter uses label-based filling - check if form has labels

2. View screenshot to understand form structure:

```bash
ls -la /data/artifacts/*landing*
```

3. Fallback is best-effort - may not work on all forms

4. Consider adding dedicated adapter for new ATS

---

## Performance Issues

### Slow Job Discovery

**Symptoms**: Job discovery takes a long time

**Solutions**:

1. Reduce `max_jobs_per_run`:

```bash
curl -X PUT http://localhost:8000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"search_preferences": {"max_jobs_per_run": 20}}'
```

2. Disable Brave Search if not needed:

```bash
# In .env
BRAVE_API_KEY=
```

3. Check network speed

4. Reduce number of connectors (comment out in `discovery.py`)

### High Memory Usage

**Symptoms**: Services consuming too much memory

**Solutions**:

1. Check memory usage:

```bash
docker stats
```

2. Limit worker memory in `docker-compose.yml`:

```yaml
services:
  worker:
    deploy:
      resources:
        limits:
          memory: 2G
```

3. Restart services:

```bash
docker compose restart
```

4. Scale horizontally instead of vertically (multiple workers)

### CPU Spikes

**Symptoms**: High CPU usage during runs

**Solutions**:

1. Check which service is spiking:

```bash
docker stats
```

2. Reduce concurrency:
   - Fewer jobs per run
   - Longer delays between actions

3. Check for infinite loops or inefficient code

4. Profile Python code:

```bash
docker compose exec worker python -m cProfile -o profile.stats -m huntarr_worker.main
```

### Queue Backlog

**Symptoms**: Many jobs in queue, processing slowly

**Solutions**:

1. Add more worker instances:

```yaml
# In docker-compose.yml
services:
  worker:
    deploy:
      replicas: 3
```

2. Increase queue poll interval:

```bash
QUEUE_POLL_INTERVAL=1
```

3. Prioritize jobs (modify priority logic)

---

## Network Issues

### Can't Access External APIs

**Symptoms**: Job discovery fails, API timeouts

**Solutions**:

1. Check internet connectivity:

```bash
docker compose exec worker ping -c 3 google.com
```

2. Check DNS resolution:

```bash
docker compose exec worker nslookup google.com
```

3. Check proxy settings if behind corporate firewall

4. Test API endpoints manually:

```bash
curl https://remoteok.com/api
```

### CORS Errors

**Symptoms**: "CORS policy" errors in browser console

**Solutions**:

1. Check CORS configuration:

```bash
grep CORS_ORIGINS .env
```

2. Set appropriate origins:

```bash
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
```

3. Restart API:

```bash
docker compose restart api
```

### Service-to-Service Communication Issues

**Symptoms**: API can't reach worker, etc.

**Solutions**:

1. Check Docker network:

```bash
docker network ls
docker network inspect huntarr_default
```

2. Ensure services are on same network

3. Restart all services:

```bash
docker compose down
docker compose up -d
```

---

## Debug Mode

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=DEBUG

# Restart services
docker compose restart
```

### View All Logs

```bash
docker compose logs -f
```

### View Specific Service Logs

```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f postgres
```

### View Real-Time Events

```bash
curl -N http://localhost:8000/api/runs/<run-id>/events
```

### Inspect Database

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U huntarr -d huntarr

# List tables
\dt

# Query table
SELECT * FROM run_sessions LIMIT 5;

# Exit
\q
```

### Inspect Docker Container

```bash
# Enter container shell
docker compose exec worker bash

# Check environment variables
env

# Check installed packages
pip list

# Exit
exit
```

---

## Getting Help

If you can't resolve your issue:

1. **Check logs**: Always check logs first for error messages
2. **Review configuration**: Ensure `.env` is correctly set
3. **Try fresh start**: Drop and recreate database (development)
4. **Search issues**: Check GitHub issues for similar problems
5. **Create issue**: Include:
   - Error messages
   - Logs (relevant sections)
   - Configuration (redact sensitive data)
   - Steps to reproduce
   - Environment (OS, Docker version, etc.)

---

For more information, see:
- [Quick Start](QUICKSTART.md)
- [User Guide](USER_GUIDE.md)
- [Configuration](CONFIGURATION.md)
- [API Reference](API_REFERENCE.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
