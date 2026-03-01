from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class RunCreateRequest(BaseModel):
    mode: Literal['manual', 'scheduled'] = 'manual'
    search_config: dict[str, Any] = Field(default_factory=dict)


class RunActionResponse(BaseModel):
    id: UUID
    status: str


class ProfilePayload(BaseModel):
    id: UUID | None = None
    full_name: str = ''
    email: str = ''
    phone: str | None = None
    location: str | None = None
    years_experience: int = 0
    summary: str = ''
    skills: list[str] = Field(default_factory=list)
    experience: list[dict[str, Any]] = Field(default_factory=list)
    education: list[dict[str, Any]] = Field(default_factory=list)
    preferences: dict[str, Any] = Field(default_factory=dict)
    rule_config: dict[str, Any] = Field(default_factory=dict)
    natural_language_override: str | None = None


class CredentialPayload(BaseModel):
    domain: str
    username: str
    password: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConfigPayload(BaseModel):
    value: dict[str, Any] = Field(default_factory=dict)


class LLMProviderCreatePayload(BaseModel):
    name: str
    base_url: str
    model: str
    api_key: str | None = None


class LLMProviderUpdatePayload(BaseModel):
    name: str | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None
    clear_api_key: bool = False


class LLMProviderTestPayload(BaseModel):
    provider_id: str | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None


class ScheduleCreateRequest(BaseModel):
    name: str
    cron_expr: str
    timezone: str = 'UTC'
    payload: dict[str, Any] = Field(default_factory=dict)


class ManualActionResolveRequest(BaseModel):
    status: Literal['resolved', 'failed']
    details: dict[str, Any] = Field(default_factory=dict)


class ManualSessionStartResponse(BaseModel):
    id: UUID
    status: str
    session_url: str


class HealthResponse(BaseModel):
    status: Literal['ok']
    database_time: datetime


class GenericListResponse(BaseModel):
    items: list[dict[str, Any]]


class JobDetailResponse(BaseModel):
    id: UUID
    source: str
    source_job_id: str
    title: str
    company: str
    location: str | None
    url: str
    description: str
    posted_at: datetime | None
    dedupe_hash: str
    raw_json: dict[str, Any]
    score: float | None
    explanation: dict[str, Any] | None
    applications: list[dict[str, Any]]
    manual_actions: list[dict[str, Any]]
    generated_documents: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class ApplicationDetailResponse(BaseModel):
    id: UUID
    run_id: UUID
    job_id: UUID
    status: str
    source_portal: str | None
    error_code: str | None
    confirmation_text: str | None
    artifacts: dict[str, Any]
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    title: str
    company: str
    location: str | None
    url: str
    description: str | None
    source: str
    source_job_id: str
    posted_at: datetime | None
    dedupe_hash: str
    score: float | None
    explanation: dict[str, Any] | None
    job: dict[str, Any]
    answers: list[dict[str, Any]]
    generated_documents: list[dict[str, Any]]
    manual_actions: list[dict[str, Any]]
    run: dict[str, Any] | None
