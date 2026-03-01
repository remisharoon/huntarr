---
title: User Guide - Huntarr
description: Complete guide to using Huntarr for automated job hunting. Learn about profiles, job discovery, applications, scheduling, and more.
keywords: user guide, profiles, job discovery, applications, scheduling, manual intervention
robots: index, follow
og:title: User Guide - Huntarr
og:description: Complete guide to using Huntarr for automated job hunting.
og:type: website
og:url: https://huntarr.github.io/huntarr/USER_GUIDE/
twitter:card: summary
twitter:title: User Guide - Huntarr
twitter:description: Complete guide to using Huntarr for automated job hunting.
---

# User Guide

Complete guide to using Huntarr for automated job hunting.

## Table of Contents

1. [Profiles](#profiles)
2. [Job Discovery](#job-discovery)
3. [Running Applications](#running-applications)
4. [Manual Interventions](#manual-interventions)
5. [Applications History](#applications-history)
6. [Credentials Management](#credentials-management)
7. [Scheduling](#scheduling)

---

## Profiles

Your profile contains all the information Huntarr needs to apply to jobs on your behalf.

### Creating a Profile

Navigate to the **Profile** page in the UI (http://localhost:5173/profile).

### Profile Fields

| Field | Description | Required |
|-------|-------------|----------|
| `name` | Your full name | Yes |
| `email` | Contact email address | Yes |
| `phone` | Phone number | Yes |
| `location` | Your location (e.g., "San Francisco, CA") | Yes |
| `linkedin_url` | LinkedIn profile URL | No |
| `github_url` | GitHub profile URL | No |
| `website` | Personal website | No |
| `skills` | List of technical skills | Yes |
| `experience` | Work experience entries | Yes |
| `education` | Education entries | No |

### Skills

Add your technical skills as a list:

```json
{
  "skills": [
    "Python",
    "JavaScript",
    "React",
    "Node.js",
    "PostgreSQL",
    "Docker",
    "AWS",
    "Machine Learning"
  ]
}
```

Tips:
- Include programming languages, frameworks, tools
- Add specific technologies (e.g., "FastAPI" vs "Python")
- Keep to 10-20 most relevant skills

### Experience

Add your work history:

```json
{
  "experience": [
    {
      "company": "Acme Corp",
      "title": "Senior Software Engineer",
      "start_date": "2020-01-01",
      "end_date": "2024-01-01",
      "description": "Led backend development for high-traffic e-commerce platform",
      "technologies": ["Python", "FastAPI", "PostgreSQL", "Redis"]
    },
    {
      "company": "Startup Inc",
      "title": "Software Developer",
      "start_date": "2017-06-01",
      "end_date": "2020-01-01",
      "description": "Built microservices architecture"
    }
  ]
}
```

Tips:
- `end_date` is optional for current roles (omit or set to null)
- `technologies` field helps with keyword matching
- `description` is used for generating cover letters

### Education

Add your educational background:

```json
{
  "education": [
    {
      "school": "University of California, Berkeley",
      "degree": "BS Computer Science",
      "graduation_date": "2017-05-01"
    }
  ]
}
```

### Upload Resume

Upload your resume PDF to auto-populate your profile:

1. Click **Upload Resume** on the Profile page
2. Select your resume PDF
3. Click **Parse Resume** to extract:
   - Contact information
   - Skills
   - Experience
   - Education

Review and edit the parsed data as needed.

### Search Preferences

Configure how Huntarr discovers and ranks jobs:

```json
{
  "search_preferences": {
    "role_keywords": ["backend developer", "software engineer"],
    "exclude_keywords": ["senior manager", "tech lead", "vp"],
    "locations": ["Remote", "San Francisco", "New York"],
    "remote_only": true,
    "salary_min": 120000,
    "salary_max": 200000,
    "aggressive_scraping": true,
    "max_jobs_per_run": 50,
    "natural_language_override": "Looking for backend roles with Python and PostgreSQL"
  }
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `role_keywords` | Must-have keywords in job title/description | `[]` |
| `exclude_keywords` | Keywords to exclude (avoid these jobs) | `[]` |
| `locations` | Target locations | `["GCC", "Remote"]` |
| `remote_only` | Only show remote jobs | `false` |
| `salary_min` | Minimum annual salary | `null` |
| `salary_max` | Maximum annual salary | `null` |
| `aggressive_scraping` | Use Brave Search API for more results | `true` |
| `max_jobs_per_run` | Maximum jobs per discovery run | `50` |
| `natural_language_override` | Natural language description of ideal job | `null` |

---

## Job Discovery

Huntarr discovers jobs from multiple sources simultaneously.

### Job Sources

| Source | Description | Requires API Key |
|--------|-------------|------------------|
| **RemoteOK** | Remote job board API | No |
| **WeWorkRemotely** | Remote job RSS feed | No |
| **Brave Search** | Web search targeting ATS domains | Yes (`BRAVE_API_KEY`) |

### Discovery Process

1. **Fetch Jobs**: All connectors run concurrently
2. **Filter Policies**: Check robots.txt compliance and platform restrictions
3. **Deduplicate**: Remove duplicates using SHA256 hash
4. **Rank**: Score jobs based on profile match
5. **Store**: Save to database

### Viewing Jobs

Navigate to the **Jobs** page (http://localhost:5173/jobs).

Jobs are displayed with:

| Field | Description |
|-------|-------------|
| Title | Job title |
| Company | Company name |
| Location | Job location |
| Source | Where the job was found |
| Score | Relevance score (0-100) |
| Posted | When the job was posted |

### Filtering Jobs

Use the filter controls to narrow down:

- By score (show only high-score jobs)
- By source (specific job boards)
- By location
- Search by title/company

### Job Ranking Algorithm

Jobs are scored based on:

1. **Keyword Match** (40%)
   - Matches in `role_keywords` increase score
   - Matches in `exclude_keywords` decrease score

2. **Location Match** (30%)
   - Exact location match
   - Remote bonus if `remote_only` is true

3. **Skills Match** (20%)
   - Overlap between your skills and job description

4. **Natural Language Override** (10%)
   - If set, uses semantic similarity

Score is calculated as:
```
score = keyword_score + location_score + skills_score + nl_score
```

Jobs below a threshold (default: 50) are filtered out.

---

## Running Applications

Huntarr supports two types of runs:

### 1. Discovery Runs

Full job discovery and application pipeline:

1. Discover jobs from all sources
2. Rank and filter jobs
3. Apply to top-ranked jobs sequentially

**Create a Discovery Run**:

1. Go to **Runs** page
2. Click **New Run**
3. Select mode: `discovery`
4. Configure search preferences (or use defaults from profile)
5. Click **Start Run**

The run will:
- Discover up to `max_jobs_per_run` jobs
- Rank all jobs
- Apply to jobs in order of score (highest first)
- Stop when complete or manually paused

### 2. Apply-Now Runs

Apply to a specific job immediately:

1. Go to **Jobs** page
2. Find the job you want
3. Click **Apply Now**
4. Monitor progress in real-time

This is useful for:
- High-priority jobs
- Testing the application flow
- One-off applications

### Monitoring Runs

On the **Runs** page, each run shows:

| Field | Description |
|-------|-------------|
| Status | `queued`, `in_progress`, `completed`, `paused`, `failed` |
| Current Node | Which step in the workflow is running |
| Jobs Applied | Number of jobs successfully applied to |
| Jobs Failed | Number of jobs that failed |
| Manual Actions | Number of manual interventions required |
| Started | When the run started |
| Duration | How long the run has been running |

### Run Status

| Status | Description |
|--------|-------------|
| `queued` | Waiting to be processed by worker |
| `in_progress` | Currently running |
| `completed` | All jobs processed (successfully or not) |
| `paused` | Manually paused (waiting for resume) |
| `failed` | Run failed due to error |

### Pausing and Resuming

**Pause a Run**:
1. Go to **Runs** page
2. Find the running run
3. Click **Pause**

The run will:
- Complete the current job
- Save state to database
- Stop processing

**Resume a Run**:
1. Go to **Runs** page
2. Find the paused run
3. Click **Resume**

The run will:
- Load saved state
- Continue from where it left off

### Real-Time Events

View real-time events for a run:

1. Click on a run
2. View the **Events** section

Events include:
- Node transitions (workflow steps)
- Job application progress
- Manual action created
- Errors and warnings

Events are streamed via SSE for live updates.

### Run Workflow Nodes

The agent graph executes these nodes in order:

1. **load_profile_and_prefs** - Load your profile and preferences
2. **discover_jobs** - Fetch jobs from all sources
3. **normalize_and_dedupe** - Standardize and remove duplicates
4. **rank_and_filter** - Score and filter jobs
5. **pick_next_job** - Select the next job to apply to
6. **prepare_documents** - Generate resume PDF and cover letter
7. **open_application_flow** - Navigate to application page
8. **handle_account_step** - Handle login/create account (with policy checks)
9. **fill_form** - Fill out application form using ATS adapter
10. **answer_questionnaire** - Answer screening questions
11. **detect_challenge** - Check for CAPTCHA or challenges
12. **manual_intervention_wait** - Wait for human intervention (if needed)
13. **submit_application** - Submit the form
14. **verify_submission** - Confirm successful submission
15. **persist_result_and_metrics** - Save results to database
16. **finalize_run** - Complete the run

---

## Manual Interventions

When Huntarr encounters a challenge it can't handle automatically, it creates a manual action.

### Types of Manual Actions

| Type | Description |
|------|-------------|
| `captcha` | CAPTCHA verification required |
| `email_verify` | Email verification required |
| `2fa` | Two-factor authentication required |
| `unexpected_form` | Form structure doesn't match any adapter |

### Manual Action Lifecycle

```
pending → in_progress → resolved
   ↓            ↓
   └────────→ failed
```

### Handling Manual Actions

1. **Detection**: Worker detects a challenge
2. **Pause**: Run is paused, state saved
3. **Create**: Manual action created in database
4. **Notify**: Displayed on Manual Queue page
5. **Session**: User starts noVNC session
6. **Resolve**: User manually resolves challenge
7. **Resume**: Run resumes automatically

### Manual Queue Page

Navigate to **Manual Queue** (http://localhost:5173/manual-queue).

Pending manual actions show:

| Field | Description |
|-------|-------------|
| Type | Type of challenge (captcha, 2fa, etc.) |
| Job | Which job triggered the action |
| Run | Which run is paused |
| Created | When the action was created |
| Status | `pending`, `in_progress`, `resolved`, `failed` |

### Starting a Manual Session

1. Find the pending manual action
2. Click **Start Session**
3. A new tab opens with noVNC (http://localhost:7900)
4. The browser shows the application page with the challenge

### Resolving the Challenge

In the noVNC session:

1. Solve the CAPTCHA
2. Enter verification code from email
3. Complete 2FA process
4. Navigate to the next page (if multi-step)

### Resuming the Run

1. Close the noVNC tab
2. Return to Huntarr
3. Click **Resolve** on the manual action
4. The run will resume from where it left off

### Failed Manual Actions

If a manual action fails:

1. Check the error message
2. Try resolving again (click **Start Session**)
3. If still failing, you may need to:
   - Verify the job URL is still valid
   - Check if the company changed their ATS
   - Report the issue

---

## Applications History

Track all your job applications.

### Viewing Applications

Navigate to **Applications** page (http://localhost:5173/applications).

Each application shows:

| Field | Description |
|-------|-------------|
| Job | Job title and company |
| Status | `submitted`, `failed`, `manual_required`, `skipped` |
| Date | When the application was submitted |
| Source Portal | Which ATS was used (Greenhouse, Lever, etc.) |
| Artifacts | Screenshots and generated documents |

### Application Status

| Status | Description |
|--------|-------------|
| `submitted` | Successfully submitted to the company |
| `failed` | Failed during submission (technical error) |
| `manual_required` | Required manual intervention (CAPTCHA, etc.) |
| `skipped` | Skipped due to platform policy or restriction |

### Viewing Artifacts

Click on an application to see:

- **Landing Screenshot** - First view of the application page
- **Post-fill Screenshot** - After form was filled
- **Result Screenshot** - After submission
- **Generated Documents** - Resume PDF and cover letter used

Artifacts are stored in `/data/artifacts` and accessible via the UI.

### Filtering Applications

Filter by:
- Status (show only submitted jobs)
- Date range
- Company
- ATS system

---

## Credentials Management

Store ATS login credentials for authenticated application flows.

### Security

- Credentials are encrypted using AES-GCM
- Encryption key derived from `VAULT_MASTER_PASSPHRASE` using PBKDF2 (390k iterations)
- Credentials are never stored in plaintext

### Adding Credentials

1. Go to **Profile** page
2. Scroll to **Credentials** section
3. Click **Add Credential**
4. Enter:

```json
{
  "domain": "acmecorp.greenhouse.io",
  "username": "your-email@example.com",
  "password": "your-password",
  "metadata": {
    "company": "Acme Corp",
    "notes": "Created 2024-01-15"
  }
}
```

5. Click **Save**

### Credential Fields

| Field | Description | Example |
|-------|-------------|---------|
| `domain` | ATS domain (exact match) | `acmecorp.greenhouse.io` |
| `username` | Login username/email | `user@example.com` |
| `password` | Password (encrypted) | `mypassword123` |
| `metadata` | Optional notes | `{ "company": "Acme" }` |

### Using Credentials

When Huntarr applies to a job:
1. Checks if URL matches a stored credential domain
2. If matched, attempts to log in
3. Uses the saved credentials automatically

### Managing Credentials

- **Edit**: Update username or password
- **Delete**: Remove stored credential
- **View**: See domain and username (password hidden)

### Supported ATS Domains

Credentials work with these ATS systems:
- `*.greenhouse.io` - Greenhouse
- `*.lever.co` - Lever
- `*.myworkdayjobs.com` - Workday
- `*.workday.com` - Workday

### Important Notes

- ⚠️ Never share your `VAULT_MASTER_PASSPHRASE`
- ⚠️ If you lose the passphrase, all credentials are lost
- ✅ Use unique passwords for each ATS
- ✅ Rotate credentials regularly

---

## Scheduling

Automate job hunting with scheduled runs.

### Creating a Schedule

1. Go to **Schedules** page (http://localhost:5173/schedules)
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
      "role_keywords": ["backend developer", "software engineer"],
      "locations": ["Remote"],
      "remote_only": true,
      "max_jobs_per_run": 20
    }
  }
}
```

4. Click **Create**

### Schedule Fields

| Field | Description | Example |
|-------|-------------|---------|
| `name` | Descriptive name | "Morning Job Hunt" |
| `cron_expr` | Cron expression | `0 9 * * 1-5` |
| `timezone` | Timezone for cron | `America/Los_Angeles` |
| `enabled` | Whether schedule is active | `true` |
| `payload` | Run configuration (search config) | See above |

### Cron Expression Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of week (0-7, 0=Sunday, 7=Sunday)
│ │ │ └─── Month (1-12)
│ │ └───── Day of month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

### Common Cron Patterns

| Pattern | Schedule |
|---------|----------|
| `0 9 * * 1-5` | 9 AM on weekdays |
| `0 */4 * * *` | Every 4 hours |
| `0 0 * * 0` | Midnight every Sunday |
| `0 9,18 * * *` | 9 AM and 6 PM daily |
| `30 8 * * 1,3,5` | 8:30 AM on Mon, Wed, Fri |
| `0 6 * * *` | 6 AM daily |
| `0 12 * * 1` | Noon every Monday |

### Managing Schedules

- **Enable/Disable**: Toggle schedule on/off
- **Edit**: Update cron expression or payload
- **Delete**: Remove schedule
- **View Next Run**: See when next execution is scheduled

### Schedule Execution

Every 2 seconds, the worker:
1. Checks for due schedules
2. Creates a new run with schedule's payload
3. Enqueues the run for processing
4. Updates `next_run_at` for the schedule

### Schedule History

Each scheduled run appears in the **Runs** page with:
- Schedule name in the description
- Trigger mode: `scheduled`

### Best Practices

1. **Don't Overrun**: Schedule 1-2 runs per day max
2. **Respect Rate Limits**: ATS systems may block aggressive automation
3. **Monitor Results**: Check applications regularly to ensure quality
4. **Adjust Timing**: Schedule runs when ATS systems are less busy

### Example Schedules

**Weekday Morning Hunt**:
```json
{
  "name": "Weekday Morning",
  "cron_expr": "0 9 * * 1-5",
  "timezone": "America/New_York",
  "enabled": true,
  "payload": {
    "search_config": {
      "role_keywords": ["software engineer"],
      "max_jobs_per_run": 15
    }
  }
}
```

**Evening Remote Jobs**:
```json
{
  "name": "Evening Remote",
  "cron_expr": "0 18 * * *",
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

**Weekend Deep Dive**:
```json
{
  "name": "Weekend Search",
  "cron_expr": "0 10 * * 6,0",
  "timezone": "UTC",
  "enabled": true,
  "payload": {
    "search_config": {
      "role_keywords": ["full stack developer"],
      "max_jobs_per_run": 30
    }
  }
}
```

---

## Tips for Success

### Profile Quality

- **Be Specific**: Add detailed skills and experience
- **Use Keywords**: Include role-specific keywords in `role_keywords`
- **Upload Resume**: Parse your resume for comprehensive data
- **Review Regularly**: Update profile as you gain new skills

### Job Discovery

- **Multiple Sources**: Enable Brave Search API for more results
- **Refine Keywords**: Use `exclude_keywords` to filter out irrelevant jobs
- **Location Strategy**: Start with `remote_only: true` then expand
- **Salary Ranges**: Set realistic ranges to filter appropriately

### Application Success

- **Credentials**: Store ATS credentials for authenticated flows
- **Monitor Manual Queue**: Respond quickly to manual actions
- **Review Artifacts**: Check screenshots for successful submissions
- **Follow Up**: Manually follow up on high-priority applications

### Scheduling

- **Start Conservative**: Begin with 1 run every few days
- **Adjust Based on Results**: Increase/decrease based on success rate
- **Avoid Peak Hours**: Don't schedule during business hours (reduces competition)
- **Weekend Scheduling**: ATS systems less busy on weekends

---

## FAQ

### Q: How many jobs can Huntarr apply to?

A: There's no hard limit, but we recommend `max_jobs_per_run: 20-50` per run to maintain quality.

### Q: Can Huntarr apply to any job?

A: Huntarr works best with ATS systems (Greenhouse, Lever, Workday). It has a fallback adapter for generic forms but success varies.

### Q: What if my run gets stuck?

A: Runs can be paused and resumed. Check the Manual Queue for pending actions.

### Q: Is Huntarr detectable by companies?

A: Huntarr uses randomized delays and human-like behavior, but companies may still detect automation. Use responsibly.

### Q: Can I use Huntarr for LinkedIn?

A: No. LinkedIn's authenticated apply flow is blocked by platform policy. Only company ATS accounts (e.g., `acme.greenhouse.io`) are allowed.

### Q: How are my credentials secured?

A: AES-GCM encryption with PBKDF2 key derivation (390k iterations). Never stored in plaintext.

### Q: Can I undo an application?

A: No. Once submitted, applications cannot be undone. Review your profile carefully before running.

### Q: What happens if I lose my VAULT_MASTER_PASSPHRASE?

A: All stored credentials will be permanently lost. Store it securely.

### Q: Can I run multiple schedules simultaneously?

A: Yes, but be mindful of ATS rate limits. We recommend staggering schedules.

### Q: How do I report a bug?

A: Open an issue on GitHub with details of the run, job URL, and any error messages.

---

Need more help? Check out:
- [API Reference](API_REFERENCE.md)
- [Configuration](CONFIGURATION.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
