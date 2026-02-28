from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    database_url: str = Field(default='postgresql://huntarr:huntarr@postgres:5432/huntarr', alias='DATABASE_URL')
    artifact_root: Path = Field(default=Path('/data/artifacts'), alias='ARTIFACT_ROOT')
    worker_id: str = Field(default='worker-1', alias='WORKER_ID')
    queue_name: str = Field(default='hunt', alias='QUEUE_NAME')
    poll_interval_seconds: float = Field(default=2.0, alias='POLL_INTERVAL_SECONDS')


settings = WorkerSettings()
