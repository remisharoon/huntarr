from __future__ import annotations

from datetime import datetime, timezone

import httpx

from huntarr_core.connectors.base import JobConnector
from huntarr_core.types import SearchConfig
from huntarr_core.utils import compute_job_dedupe_hash


class RemoteOkConnector(JobConnector):
    source_name = "remoteok"
    endpoint = "https://remoteok.com/api"

    async def fetch_jobs(self, config: SearchConfig) -> list[dict]:
        headers = {"User-Agent": "huntarr-bot/0.1"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(self.endpoint, headers=headers)
            response.raise_for_status()
            payload = response.json()

        jobs: list[dict] = []
        for item in payload[1:]:
            title = item.get("position") or ""
            if not title:
                continue
            url = item.get("url") or ""
            if not url:
                continue
            company = item.get("company") or "Unknown"
            location = item.get("location") or "Remote"
            source_job_id = str(item.get("id") or url)
            dedupe_hash = compute_job_dedupe_hash(title, company, location, url)
            jobs.append(
                {
                    "source": self.source_name,
                    "source_job_id": source_job_id,
                    "title": title,
                    "company": company,
                    "location": location,
                    "url": url,
                    "description": item.get("description") or "",
                    "posted_at": datetime.now(timezone.utc),
                    "source_meta": item,
                    "dedupe_hash": dedupe_hash,
                }
            )
            if len(jobs) >= config.max_jobs_per_run:
                break
        return jobs
