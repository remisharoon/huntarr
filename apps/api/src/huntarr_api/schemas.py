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
