from __future__ import annotations

from abc import ABC, abstractmethod

from huntarr_core.types import SearchConfig


class JobConnector(ABC):
    source_name: str

    @abstractmethod
    async def fetch_jobs(self, config: SearchConfig) -> list[dict]:
        raise NotImplementedError
