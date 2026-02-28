# API Reference

Complete reference for Huntarr REST API.

## Base URL

```
http://localhost:8000
```

Interactive API documentation available at: http://localhost:8000/docs

## Authentication

Currently, no authentication is required for local development. In production, implement authentication as needed.

## Response Format

All API responses return JSON:

```json
{
  "field1": "value1",
  "field2": 123,
  "nested": {
    "key": "value"
  }
}
```

## Error Responses

Errors follow standard HTTP status codes:

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Internal Server Error |

Error response format:

```json
{
  "detail": "Error message description"
}
```

---

## Runs

### Create Run

Creates a new run for job discovery or application.

**Endpoint**: `POST /api/runs`

**Request Body**:

```json
{
  "mode": "discovery",
  "search_config": {
    "role_keywords": ["backend developer", "software engineer"],
    "exclude_keywords": ["senior manager", "vp"],
    "locations": ["Remote", "San Francisco"],
    "remote_only": true,
    "salary_min": 120000,
    "salary_max": 200000,
    "aggressive_scraping": true,
    "max_jobs_per_run": 20
  }
}
```

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | Yes | `discovery` or `apply-now` |
| `search_config` | object | Yes | Search preferences (see below) |
| `search_config.role_keywords` | string[] | No | Keywords to match |
| `search_config.exclude_keywords` | string[] | No | Keywords to exclude |
| `search_config.locations` | string[] | No | Target locations |
| `search_config.remote_only` | boolean | No | Only remote jobs |
| `search_config.salary_min` | integer | No | Minimum salary |
| `search_config.salary_max` | integer | No | Maximum salary |
| `search_config.aggressive_scraping` | boolean | No | Use Brave Search API |
| `search_config.max_jobs_per_run` | integer | No | Max jobs per run |
| `search_config.target_job_id` | string | No | Specific job ID (for apply-now) |

**Response**: `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "profile_id": "550e8400-e29b-41d4-a716-446655440001",
  "mode": "discovery",
  "status": "queued",
  "search_config": {
    "role_keywords": ["backend developer"]
  },
  "created_at": "2024-01-15T10:00:00Z",
  "started_at": null,
  "completed_at": null,
  "current_node": null,
  "metrics": {
    "jobs_discovered": 0,
    "jobs_applied": 0,
    "jobs_failed": 0,
    "manual_required": 0,
    "skipped": 0
  }
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discovery",
    "search_config": {
      "role_keywords": ["backend developer"],
      "locations": ["Remote"],
      "remote_only": true,
      "max_jobs_per_run": 10
    }
  }'
```

**Example (Python)**:

```python
import requests

response = requests.post(
    "http://localhost:8000/api/runs",
    json={
        "mode": "discovery",
        "search_config": {
            "role_keywords": ["backend developer"],
            "locations": ["Remote"],
            "remote_only": True,
            "max_jobs_per_run": 10
        }
    }
)
run = response.json()
print(f"Run ID: {run['id']}")
```

**Example (JavaScript)**:

```javascript
const response = await fetch('http://localhost:8000/api/runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'discovery',
    search_config: {
      role_keywords: ['backend developer'],
      locations: ['Remote'],
      remote_only: true,
      max_jobs_per_run: 10
    }
  })
});
const run = await response.json();
console.log('Run ID:', run.id);
```

---

### List Runs

Get a list of all runs.

**Endpoint**: `GET /api/runs`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum number of runs to return (1-500) |

**Response**: `200 OK`

```json
{
  "runs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "profile_id": "550e8400-e29b-41d4-a716-446655440001",
      "mode": "discovery",
      "status": "completed",
      "created_at": "2024-01-15T10:00:00Z",
      "started_at": "2024-01-15T10:00:05Z",
      "completed_at": "2024-01-15T10:15:30Z",
      "current_node": "finalize_run",
      "metrics": {
        "jobs_discovered": 25,
        "jobs_applied": 18,
        "jobs_failed": 2,
        "manual_required": 3,
        "skipped": 2
      }
    }
  ],
  "total": 1
}
```

**Example (curl)**:

```bash
curl http://localhost:8000/api/runs?limit=10
```

---

### Get Run Details

Get details of a specific run.

**Endpoint**: `GET /api/runs/{run_id}`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | string (UUID) | Run ID |

**Response**: `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "profile_id": "550e8400-e29b-41d4-a716-446655440001",
  "mode": "discovery",
  "status": "in_progress",
  "search_config": {
    "role_keywords": ["backend developer"]
  },
  "created_at": "2024-01-15T10:00:00Z",
  "started_at": "2024-01-15T10:00:05Z",
  "completed_at": null,
  "current_node": "fill_form",
  "metrics": {
    "jobs_discovered": 25,
    "jobs_applied": 5,
    "jobs_failed": 0,
    "manual_required": 1,
    "skipped": 0
  }
}
```

**Example (curl)**:

```bash
curl http://localhost:8000/api/runs/550e8400-e29b-41d4-a716-446655440000
```

---

### Pause Run

Pause a running run.

**Endpoint**: `POST /api/runs/{run_id}/pause`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | string (UUID) | Run ID |

**Response**: `200 OK`

```json
{
  "status": "paused"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/runs/550e8400-e29b-41d4-a716-446655440000/pause
```

---

### Resume Run

Resume a paused run.

**Endpoint**: `POST /api/runs/{run_id}/resume`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | string (UUID) | Run ID |

**Response**: `200 OK`

```json
{
  "status": "resuming"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/runs/550e8400-e29b-41d4-a716-446655440000/resume
```

---

### Run Events Stream (SSE)

Stream real-time events for a run using Server-Sent Events.

**Endpoint**: `GET /api/runs/{run_id}/events`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `run_id` | string (UUID) | Run ID |

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `after_id` | integer | 0 | Return events after this event ID |

**Response**: `text/event-stream`

Events are streamed as SSE messages:

```
data: {"id":1,"run_id":"550e8400-e29b-41d4-a716-446655440000","level":"info","source":"agent","event_type":"node_start","message":"Starting node: load_profile_and_prefs","data":{"node":"load_profile_and_prefs"},"timestamp":"2024-01-15T10:00:05Z"}

data: {"id":2,"run_id":"550e8400-e29b-41d4-a716-446655440000","level":"info","source":"agent","event_type":"node_complete","message":"Completed node: load_profile_and_prefs","data":{"node":"load_profile_and_prefs","duration_ms":250},"timestamp":"2024-01-15T10:00:05Z"}
```

**Event Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Event ID |
| `run_id` | string (UUID) | Run ID |
| `level` | string | `info`, `warning`, `error` |
| `source` | string | Event source (`agent`, `api`, `worker`, `browser`) |
| `event_type` | string | Event type (see below) |
| `message` | string | Human-readable message |
| `data` | object | Event-specific data |
| `timestamp` | string | ISO 8601 timestamp |

**Event Types**:

| Type | Description |
|------|-------------|
| `run_created` | Run created via API |
| `run_started` | Run started processing |
| `run_paused` | Run paused |
| `run_resumed` | Run resumed |
| `run_completed` | Run completed |
| `node_start` | Agent node started |
| `node_complete` | Agent node completed |
| `job_discovered` | Job discovered |
| `job_selected` | Job selected for application |
| `job_submitted` | Application submitted successfully |
| `job_failed` | Application failed |
| `manual_action_created` | Manual action created |
| `manual_action_resolved` | Manual action resolved |

**Example (curl)**:

```bash
curl -N http://localhost:8000/api/runs/550e8400-e29b-41d4-a716-446655440000/events
```

**Example (JavaScript)**:

```javascript
const eventSource = new EventSource(
  'http://localhost:8000/api/runs/550e8400-e29b-41d4-a716-446655440000/events'
);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
});
```

---

## Jobs

### List Jobs

Get a list of discovered jobs.

**Endpoint**: `GET /api/jobs`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum jobs to return |
| `offset` | integer | 0 | Pagination offset |
| `min_score` | float | 0 | Minimum relevance score |
| `source` | string | null | Filter by source |

**Response**: `200 OK`

```json
{
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "source": "remoteok",
      "source_job_id": "123456",
      "title": "Senior Backend Engineer",
      "company": "Acme Corp",
      "location": "Remote",
      "url": "https://remoteok.com/remote-jobs/123456",
      "description": "We are looking for...",
      "posted_at": "2024-01-15T09:00:00Z",
      "score": 85.5,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 100
}
```

**Example (curl)**:

```bash
curl "http://localhost:8000/api/jobs?limit=20&min_score=70"
```

---

### Get Job Details

Get details of a specific job.

**Endpoint**: `GET /api/jobs/{job_id}`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | string (UUID) | Job ID |

**Response**: `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "source": "remoteok",
  "source_job_id": "123456",
  "title": "Senior Backend Engineer",
  "company": "Acme Corp",
  "location": "Remote",
  "url": "https://remoteok.com/remote-jobs/123456",
  "description": "Full job description here...",
  "posted_at": "2024-01-15T09:00:00Z",
  "score": 85.5,
  "score_explanation": {
    "matched_keywords": ["backend", "engineer"],
    "location_match": ["remote"],
    "skills_match": ["python", "fastapi"]
  },
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Example (curl)**:

```bash
curl http://localhost:8000/api/jobs/550e8400-e29b-41d4-a716-446655440002
```

---

### Apply to Job Now

Create an apply-now run for a specific job.

**Endpoint**: `POST /api/jobs/{job_id}/apply-now`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | string (UUID) | Job ID |

**Request Body**: (optional)

```json
{
  "search_config": {
    "custom_field": "value"
  }
}
```

**Response**: `201 Created`

```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440003",
  "status": "queued",
  "mode": "apply-now",
  "target_job_id": "550e8400-e29b-41d4-a716-446655440002"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/jobs/550e8400-e29b-41d4-a716-446655440002/apply-now
```

---

## Applications

### List Applications

Get a list of application attempts.

**Endpoint**: `GET /api/applications`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum applications to return |
| `offset` | integer | 0 | Pagination offset |
| `status` | string | null | Filter by status (`submitted`, `failed`, `manual_required`, `skipped`) |
| `job_id` | string (UUID) | null | Filter by job ID |

**Response**: `200 OK`

```json
{
  "applications": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "run_id": "550e8400-e29b-41d4-a716-446655440003",
      "job_id": "550e8400-e29b-41d4-a716-446655440002",
      "status": "submitted",
      "source_portal": "greenhouse",
      "created_at": "2024-01-15T10:05:00Z",
      "updated_at": "2024-01-15T10:06:30Z"
    }
  ],
  "total": 50
}
```

**Example (curl)**:

```bash
curl "http://localhost:8000/api/applications?status=submitted&limit=20"
```

---

## Manual Actions

### List Manual Actions

Get pending and resolved manual actions.

**Endpoint**: `GET /api/manual-actions`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | null | Filter by status (`pending`, `in_progress`, `resolved`, `failed`) |
| `limit` | integer | 50 | Maximum actions to return |

**Response**: `200 OK`

```json
{
  "manual_actions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "run_id": "550e8400-e29b-41d4-a716-446655440003",
      "job_id": "550e8400-e29b-41d4-a716-446655440002",
      "action_type": "captcha",
      "status": "pending",
      "details": {
        "url": "https://acme.greenhouse.io/jobs/12345",
        "description": "reCAPTCHA detected on application form"
      },
      "session_url": null,
      "created_at": "2024-01-15T10:06:00Z",
      "updated_at": "2024-01-15T10:06:00Z"
    }
  ],
  "total": 1
}
```

**Example (curl)**:

```bash
curl "http://localhost:8000/api/manual-actions?status=pending"
```

---

### Start Manual Session

Start a noVNC session for manual intervention.

**Endpoint**: `POST /api/manual-actions/{action_id}/start-session`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action_id` | string (UUID) | Manual action ID |

**Response**: `200 OK`

```json
{
  "status": "in_progress",
  "session_url": "http://localhost:7900/?token=abc123"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/manual-actions/550e8400-e29b-41d4-a716-446655440005/start-session
```

---

### Resolve Manual Action

Mark a manual action as resolved and resume the run.

**Endpoint**: `POST /api/manual-actions/{action_id}/resolve`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `action_id` | string (UUID) | Manual action ID |

**Request Body**:

```json
{
  "resolution": "captcha_solved",
  "notes": "Successfully solved reCAPTCHA"
}
```

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resolution` | string | Yes | How the action was resolved |
| `notes` | string | No | Optional notes |

**Response**: `200 OK`

```json
{
  "status": "resolved",
  "run_status": "resuming"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/manual-actions/550e8400-e29b-41d4-a716-446655440005/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "captcha_solved",
    "notes": "Successfully solved reCAPTCHA"
  }'
```

---

## Profile

### Get Profile

Get the current user profile.

**Endpoint**: `GET /api/profile`

**Response**: `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "location": "San Francisco, CA",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "github_url": "https://github.com/johndoe",
  "website": "https://johndoe.com",
  "skills": [
    "Python",
    "JavaScript",
    "React",
    "FastAPI"
  ],
  "experience": [
    {
      "company": "Acme Corp",
      "title": "Senior Software Engineer",
      "start_date": "2020-01-01",
      "end_date": "2024-01-01",
      "description": "Built scalable systems"
    }
  ],
  "education": [
    {
      "school": "University of California, Berkeley",
      "degree": "BS Computer Science",
      "graduation_date": "2019-05-01"
    }
  ],
  "search_preferences": {
    "role_keywords": ["backend developer", "software engineer"],
    "locations": ["Remote", "San Francisco"],
    "remote_only": true,
    "max_jobs_per_run": 20
  },
  "created_at": "2024-01-15T09:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

**Example (curl)**:

```bash
curl http://localhost:8000/api/profile
```

---

### Update Profile

Update the current user profile.

**Endpoint**: `PUT /api/profile`

**Request Body**: Partial profile object

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "location": "San Francisco, CA",
  "skills": [
    "Python",
    "JavaScript",
    "React",
    "FastAPI",
    "PostgreSQL"
  ],
  "experience": [
    {
      "company": "Acme Corp",
      "title": "Senior Software Engineer",
      "start_date": "2020-01-01",
      "end_date": "2024-01-01",
      "description": "Built scalable systems",
      "technologies": ["Python", "FastAPI", "PostgreSQL"]
    }
  ],
  "search_preferences": {
    "role_keywords": ["backend developer", "software engineer"],
    "locations": ["Remote", "San Francisco"],
    "remote_only": true,
    "max_jobs_per_run": 25
  }
}
```

**Response**: `200 OK`

```json
{
  "status": "updated",
  "profile_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Example (curl)**:

```bash
curl -X PUT http://localhost:8000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "location": "San Francisco, CA",
    "skills": ["Python", "JavaScript", "React", "FastAPI"]
  }'
```

---

### Upload Resume

Upload a resume PDF.

**Endpoint**: `POST /api/profile/resume-upload`

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resume` | file | Yes | PDF file (max 5MB) |

**Response**: `200 OK`

```json
{
  "status": "uploaded",
  "filename": "resume.pdf",
  "path": "/data/uploads/resume_20240115_100000.pdf"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/profile/resume-upload \
  -F "resume=@/path/to/your/resume.pdf"
```

---

### Parse Resume

Parse an uploaded resume PDF to extract profile information.

**Endpoint**: `POST /api/profile/parse-resume`

**Response**: `200 OK`

```json
{
  "status": "parsed",
  "extracted": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "skills": ["Python", "JavaScript", "React"],
    "experience": [
      {
        "company": "Acme Corp",
        "title": "Software Engineer",
        "start_date": "2020-01-01",
        "end_date": "2024-01-01",
        "description": "..."
      }
    ],
    "education": [
      {
        "school": "University of California, Berkeley",
        "degree": "BS Computer Science",
        "graduation_date": "2019-05-01"
      }
    ]
  }
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/profile/parse-resume
```

---

## Configuration

### Get System Config

Get system configuration.

**Endpoint**: `GET /api/config`

**Response**: `200 OK`

```json
{
  "auto_submit_enabled": true,
  "browser_headless": true,
  "queue_poll_interval": 2,
  "max_retry_attempts": 3
}
```

**Example (curl)**:

```bash
curl http://localhost:8000/api/config
```

---

### Update System Config

Update system configuration.

**Endpoint**: `PUT /api/config`

**Request Body**:

```json
{
  "auto_submit_enabled": false,
  "browser_headless": false
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `auto_submit_enabled` | boolean | Enable auto-submit of applications |
| `browser_headless` | boolean | Run browser in headless mode |

**Response**: `200 OK`

```json
{
  "status": "updated"
}
```

**Example (curl)**:

```bash
curl -X PUT http://localhost:8000/api/config \
  -H "Content-Type: application/json" \
  -d '{
    "auto_submit_enabled": false,
    "browser_headless": false
  }'
```

---

## Credentials

### Store Credential

Store an encrypted credential for an ATS domain.

**Endpoint**: `POST /api/credentials`

**Request Body**:

```json
{
  "domain": "acmecorp.greenhouse.io",
  "username": "user@example.com",
  "password": "mypassword123",
  "metadata": {
    "company": "Acme Corp",
    "notes": "Created 2024-01-15"
  }
}
```

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | Yes | ATS domain (exact match) |
| `username` | string | Yes | Login username/email |
| `password` | string | Yes | Password (will be encrypted) |
| `metadata` | object | No | Optional metadata |

**Response**: `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440006",
  "domain": "acmecorp.greenhouse.io",
  "username": "user@example.com",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "acmecorp.greenhouse.io",
    "username": "user@example.com",
    "password": "mypassword123",
    "metadata": {
      "company": "Acme Corp"
    }
  }'
```

---

## Schedules

### List Schedules

Get all scheduled runs.

**Endpoint**: `GET /api/schedules`

**Response**: `200 OK`

```json
{
  "schedules": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440007",
      "name": "Morning Job Hunt",
      "cron_expr": "0 9 * * 1-5",
      "timezone": "America/Los_Angeles",
      "enabled": true,
      "payload": {
        "search_config": {
          "role_keywords": ["backend developer"],
          "max_jobs_per_run": 20
        }
      },
      "next_run_at": "2024-01-15T09:00:00Z",
      "last_run_at": "2024-01-14T09:00:00Z",
      "created_at": "2024-01-10T10:00:00Z"
    }
  ],
  "total": 1
}
```

**Example (curl)**:

```bash
curl http://localhost:8000/api/schedules
```

---

### Create Schedule

Create a new scheduled run.

**Endpoint**: `POST /api/schedules`

**Request Body**:

```json
{
  "name": "Morning Job Hunt",
  "cron_expr": "0 9 * * 1-5",
  "timezone": "America/Los_Angeles",
  "enabled": true,
  "payload": {
    "search_config": {
      "role_keywords": ["backend developer", "software engineer"],
      "locations": ["Remote"],
      "remote_only": true,
      "max_jobs_per_run": 20
    }
  }
}
```

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Schedule name |
| `cron_expr` | string | Yes | Cron expression |
| `timezone` | string | No | Timezone (default: UTC) |
| `enabled` | boolean | No | Enable/disable (default: true) |
| `payload` | object | Yes | Run configuration |

**Response**: `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440007",
  "name": "Morning Job Hunt",
  "cron_expr": "0 9 * * 1-5",
  "timezone": "America/Los_Angeles",
  "enabled": true,
  "next_run_at": "2024-01-15T09:00:00Z",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Example (curl)**:

```bash
curl -X POST http://localhost:8000/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

---

## Health

### Health Check

Check API and database health.

**Endpoint**: `GET /api/health`

**Response**: `200 OK`

```json
{
  "status": "ok",
  "database_time": "2024-01-15T10:00:00Z"
}
```

**Example (curl)**:

```bash
curl http://localhost:8000/api/health
```

---

## Rate Limiting

Currently, no rate limiting is enforced for local development. In production, implement appropriate rate limiting.

## CORS

CORS is enabled for all origins (`allow_origins: ['*']`). Configure appropriately for production.

## Errors

### Common Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid JSON or missing fields |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error - Server error |

### Error Response Format

```json
{
  "detail": "Error message description"
}
```

---

## SDK Examples

### Python SDK (Requests)

```python
import requests

BASE_URL = "http://localhost:8000"

# Create a run
def create_run():
    response = requests.post(
        f"{BASE_URL}/api/runs",
        json={
            "mode": "discovery",
            "search_config": {
                "role_keywords": ["backend developer"],
                "max_jobs_per_run": 10
            }
        }
    )
    return response.json()

# Monitor run events
def stream_events(run_id):
    response = requests.get(
        f"{BASE_URL}/api/runs/{run_id}/events",
        stream=True
    )
    for line in response.iter_lines():
        if line:
            print(line.decode('utf-8'))

# Apply to job
def apply_now(job_id):
    response = requests.post(
        f"{BASE_URL}/api/jobs/{job_id}/apply-now"
    )
    return response.json()
```

### JavaScript SDK (Fetch)

```javascript
const BASE_URL = 'http://localhost:8000';

// Create a run
async function createRun() {
  const response = await fetch(`${BASE_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'discovery',
      search_config: {
        role_keywords: ['backend developer'],
        max_jobs_per_run: 10
      }
    })
  });
  return await response.json();
}

// Stream run events
function streamEvents(runId) {
  const eventSource = new EventSource(
    `${BASE_URL}/api/runs/${runId}/events`
  );
  eventSource.addEventListener('message', (event) => {
    console.log(JSON.parse(event.data));
  });
}

// Apply to job
async function applyNow(jobId) {
  const response = await fetch(
    `${BASE_URL}/api/jobs/${jobId}/apply-now`,
    { method: 'POST' }
  );
  return await response.json();
}
```

---

For more information, see:
- [Quick Start](QUICKSTART.md)
- [User Guide](USER_GUIDE.md)
- [Configuration](CONFIGURATION.md)
- [Troubleshooting](TROUBLESHOOTING.md)
