from __future__ import annotations

import os
from datetime import UTC, datetime

import httpx

from huntarr_core.connectors.base import JobConnector
from huntarr_core.types import SearchConfig
from huntarr_core.utils import compute_job_dedupe_hash


class BraveSearchConnector(JobConnector):
    source_name = "brave_search"
    endpoint = "https://api.search.brave.com/res/v1/web/search"

    async def fetch_jobs(self, config: SearchConfig) -> list[dict]:
        api_key = os.getenv("BRAVE_API_KEY")
        if not api_key:
            return []

        keywords = " OR ".join(config.role_keywords) if config.role_keywords else "software engineer"
        loc = " OR ".join(config.locations) if config.locations else "GCC OR remote"
        query = f"({keywords}) jobs ({loc}) site:jobs.lever.co OR site:greenhouse.io OR site:workday.com"

        headers = {
            "Accept": "application/json",
            "X-Subscription-Token": api_key,
        }
        params = {"q": query, "count": min(config.max_jobs_per_run, 20)}

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(self.endpoint, headers=headers, params=params)
            response.raise_for_status()
            payload = response.json()

        jobs: list[dict] = []
        for item in payload.get("web", {}).get("results", []):
            url = item.get("url")
            title = item.get("title", "")
            description = item.get("description", "")
            if not url or not title:
                continue
            company = item.get("profile", {}).get("name", "Unknown")
            location = "Remote/GCC"
            dedupe_hash = compute_job_dedupe_hash(title, company, location, url)
            jobs.append(
                {
                    "source": self.source_name,
                    "source_job_id": url,
                    "title": title,
                    "company": company,
                    "location": location,
                    "url": url,
                    "description": description,
                    "posted_at": datetime.now(UTC),
                    "source_meta": item,
                    "dedupe_hash": dedupe_hash,
                }
            )
        return jobs
