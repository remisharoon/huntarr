from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_env: str = Field(default='development', alias='APP_ENV')
    app_host: str = Field(default='0.0.0.0', alias='APP_HOST')
    app_port: int = Field(default=8000, alias='APP_PORT')

    database_url: str = Field(default='postgresql://huntarr:huntarr@postgres:5432/huntarr', alias='DATABASE_URL')
    artifact_root: Path = Field(default=Path('/data/artifacts'), alias='ARTIFACT_ROOT')
    uploads_root: Path = Field(default=Path('/data/uploads'), alias='UPLOADS_ROOT')
    vault_master_passphrase: str = Field(default='change-me', alias='VAULT_MASTER_PASSPHRASE')
    manual_session_url: str = Field(default='http://localhost:7900', alias='PLAYWRIGHT_VNC_URL')

    openai_base_url: str = Field(default='https://api.openai.com/v1', alias='OPENAI_BASE_URL')
    openai_api_key: str = Field(default='', alias='OPENAI_API_KEY')
    openai_model: str = Field(default='gpt-4o-mini', alias='OPENAI_MODEL')


settings = Settings()
