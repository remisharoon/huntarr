from __future__ import annotations

import asyncio
import logging
import os
import re

from huntarr_core.connectors.base import JobConnector
from huntarr_core.connectors.brave_search import BraveSearchConnector
from huntarr_core.connectors.remoteok import RemoteOkConnector
from huntarr_core.connectors.weworkremotely import WeWorkRemotelyConnector
from huntarr_core.types import SearchConfig

logger = logging.getLogger(__name__)


def default_connectors() -> list[JobConnector]:
    return [RemoteOkConnector(), WeWorkRemotelyConnector(), BraveSearchConnector()]


def _matches_keywords(text: str, keywords: list[str]) -> bool:
    if not keywords:
        return True
    text_lower = text.lower()
    return any(keyword.lower() in text_lower for keyword in keywords)


def _matches_exclusions(text: str, exclude_keywords: list[str]) -> bool:
    if not exclude_keywords:
        return True
    text_lower = text.lower()
    return not any(keyword.lower() in text_lower for keyword in exclude_keywords)


def _matches_location(job_location: str | None, locations: list[str], remote_only: bool) -> bool:
    if not job_location:
        return not remote_only
    job_loc_lower = job_location.lower()
    
    if remote_only:
        return "remote" in job_loc_lower
    
    if not locations:
        return True
    
    locations_lower = [loc.lower() for loc in locations]
    
    for loc in locations_lower:
        if loc in job_loc_lower:
            return True
    
    gcc_locations = [
        "united arab emirates", "uae", "dubai", "abu dhabi", "sharjah", 
        "saudi arabia", "ksa", "riyadh", "jeddah",
        "qatar", "doha",
        "kuwait", "kuwait city",
        "bahrain", "manama",
        "oman", "muscat"
    ]
    
    if any(gcc in job_loc_lower for gcc in gcc_locations):
        if "gcc" in locations_lower:
            return True
    
    return False


def _matches_salary(job_description: str, salary_min: int | None, salary_max: int | None) -> bool:
    if not salary_min and not salary_max:
        return True
    
    desc_lower = job_description.lower()
    
    if salary_min and salary_max:
        return salary_min <= salary_max
    
    return True


def _filter_job(job: dict, config: SearchConfig) -> bool:
    searchable_text = " ".join([
        job.get("title", ""),
        job.get("description", ""),
        job.get("company", ""),
    ]).lower()
    
    job_title = job.get("title", "")
    job_loc = job.get("location", "")
    
    if config.role_keywords:
        title_match = _matches_keywords(job_title, config.role_keywords)
        desc_match = _matches_keywords(job.get("description", ""), config.role_keywords)
        
        if not title_match and not desc_match:
            logger.debug("job_filtered_keywords", extra={
                "job_title": job_title,
                "job_location": job_loc,
                "required_keywords": config.role_keywords,
                "reason": "no keyword match"
            })
            return False
    
    if config.exclude_keywords:
        if not _matches_exclusions(searchable_text, config.exclude_keywords):
            logger.debug("job_filtered_excluded", extra={
                "job_title": job_title,
                "job_location": job_loc,
                "exclude_keywords": config.exclude_keywords,
            })
            return False
    
    if not _matches_location(job_loc, config.locations, config.remote_only):
        logger.debug("job_filtered_location", extra={
            "job_title": job_title,
            "job_location": job_loc,
            "required_locations": config.locations,
            "remote_only": config.remote_only,
        })
        return False
    
    logger.debug("job_passed", extra={
        "job_title": job_title,
        "job_location": job_loc,
    })
    return True

async def discover_jobs(config: SearchConfig) -> list[dict]:
    jobs: list[dict] = []

    all_connectors = default_connectors()

    requested_sources = config.sources if config.sources else [
        "remoteok", "weworkremotely", "brave_search"
    ]

    selected_connectors = []
    for connector in all_connectors:
        source_name = connector.source_name

        if source_name not in requested_sources:
            continue

        if source_name == "brave_search":
            api_key = os.getenv("BRAVE_API_KEY")
            if not api_key:
                logger.warning("brave_search_skipped", extra={"reason": "BRAVE_API_KEY not set"})
                continue

        selected_connectors.append(connector)

    if not selected_connectors:
        logger.warning("no_connectors_selected", extra={"requested_sources": requested_sources})
        return []

    tasks = [connector.fetch_jobs(config) for connector in selected_connectors]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    for connector, response in zip(selected_connectors, responses, strict=False):
        if isinstance(response, Exception):
            logger.warning("connector_failed", extra={"source": connector.source_name, "error": str(response)})
            continue

        jobs_from_source = len(response) if isinstance(response, list) else 0
        logger.info("jobs_fetched", extra={
            "source": connector.source_name,
            "count": jobs_from_source,
        })

        for job in response:
            url = job.get("url")
            if not url:
                continue
            
            if _filter_job(job, config):
                jobs.append(job)
            else:
                logger.debug("job_filtered", extra={
                    "source": connector.source_name,
                    "job_title": job.get("title"),
                    "job_location": job.get("location"),
                })

    logger.info("jobs_after_filtering", extra={
        "total_fetched": len(jobs),
        "max_limit": config.max_jobs_per_run,
    })

    return jobs[: config.max_jobs_per_run]
