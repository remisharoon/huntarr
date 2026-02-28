from __future__ import annotations

from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup

from huntarr_core.connectors.base import JobConnector
from huntarr_core.types import SearchConfig
from huntarr_core.utils import compute_job_dedupe_hash


class WeWorkRemotelyConnector(JobConnector):
    source_name = "weworkremotely"
    endpoint = "https://weworkremotely.com/remote-jobs.rss"

    async def fetch_jobs(self, config: SearchConfig) -> list[dict]:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(self.endpoint, headers={"User-Agent": "huntarr-bot/0.1"})
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "xml")
        items = soup.find_all("item")

        jobs: list[dict] = []
        for item in items:
            title_text = item.title.text if item.title else ""
            title_parts = [p.strip() for p in title_text.split(":", 1)]
            company = title_parts[0] if len(title_parts) > 1 else "Unknown"
            title = title_parts[1] if len(title_parts) > 1 else title_text
            url = item.link.text if item.link else ""
            if not url:
                continue
            location = "Remote"
            dedupe_hash = compute_job_dedupe_hash(title, company, location, url)
            jobs.append(
                {
                    "source": self.source_name,
                    "source_job_id": url,
                    "title": title,
                    "company": company,
                    "location": location,
                    "url": url,
                    "description": item.description.text if item.description else "",
                    "posted_at": datetime.now(timezone.utc),
                    "source_meta": {"raw_title": title_text},
                    "dedupe_hash": dedupe_hash,
                }
            )
            if len(jobs) >= config.max_jobs_per_run:
                break

        return jobs
