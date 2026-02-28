from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class SearchConfig(BaseModel):
    role_keywords: list[str] = Field(default_factory=list)
    exclude_keywords: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=lambda: ["GCC", "Remote"])
    remote_only: bool = False
    salary_min: int | None = None
    salary_max: int | None = None
    natural_language_override: str | None = None
    aggressive_scraping: bool = True
    max_jobs_per_run: int = 50
    target_job_id: str | None = None


class JobPosting(BaseModel):
    id: UUID | None = None
    source: str
    source_job_id: str
    title: str
    company: str
    location: str | None = None
    url: str
    description: str = ""
    posted_at: datetime | None = None
    source_meta: dict[str, Any] = Field(default_factory=dict)
    dedupe_hash: str


class JobScore(BaseModel):
    job_id: UUID
    score: float
    explanation: dict[str, Any] = Field(default_factory=dict)


class ApplicationAttempt(BaseModel):
    id: UUID | None = None
    run_id: UUID
    job_id: UUID
    status: Literal[
        "queued",
        "in_progress",
        "submitted",
        "failed",
        "manual_required",
        "skipped",
    ]
    failure_code: str | None = None
    source_portal: str | None = None
    artifacts: dict[str, Any] = Field(default_factory=dict)


class ManualAction(BaseModel):
    id: UUID | None = None
    run_id: UUID
    job_id: UUID
    action_type: Literal["captcha", "email_verify", "2fa", "unexpected_form"]
    status: Literal["pending", "in_progress", "resolved", "failed"] = "pending"
    details: dict[str, Any] = Field(default_factory=dict)
    session_url: str | None = None


class CredentialRef(BaseModel):
    id: UUID | None = None
    domain: str
    username: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ScheduleRule(BaseModel):
    id: UUID | None = None
    name: str
    cron_expr: str
    timezone: str = "UTC"
    enabled: bool = True
    payload: dict[str, Any] = Field(default_factory=dict)
