from __future__ import annotations

import asyncio
import logging

from huntarr_core.connectors.base import JobConnector
from huntarr_core.connectors.brave_search import BraveSearchConnector
from huntarr_core.connectors.policies import robots_allows
from huntarr_core.connectors.remoteok import RemoteOkConnector
from huntarr_core.connectors.weworkremotely import WeWorkRemotelyConnector
from huntarr_core.types import SearchConfig

logger = logging.getLogger(__name__)


def default_connectors() -> list[JobConnector]:
    return [RemoteOkConnector(), WeWorkRemotelyConnector(), BraveSearchConnector()]


async def discover_jobs(config: SearchConfig) -> list[dict]:
    jobs: list[dict] = []

    connectors = default_connectors()
    tasks = [connector.fetch_jobs(config) for connector in connectors]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    for connector, response in zip(connectors, responses, strict=True):
        if isinstance(response, Exception):
            logger.warning("connector_failed", extra={"source": connector.source_name, "error": str(response)})
            continue

        for job in response:
            url = job.get("url")
            if not url:
                continue
            if not robots_allows(url):
                continue
            jobs.append(job)

    return jobs[: config.max_jobs_per_run]
