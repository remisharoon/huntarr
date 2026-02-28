from __future__ import annotations

from typing import Any

from huntarr_core.types import SearchConfig
from huntarr_core.utils import normalize_text


def score_job(job: dict[str, Any], search_config: SearchConfig) -> tuple[float, dict[str, Any]]:
    title = normalize_text(job.get("title", ""))
    description = normalize_text(job.get("description", ""))
    location = normalize_text(job.get("location", ""))

    score = 0.0
    matched_keywords: list[str] = []
    excluded_keywords: list[str] = []

    for keyword in search_config.role_keywords:
        kw = normalize_text(keyword)
        if kw and (kw in title or kw in description):
            score += 20
            matched_keywords.append(keyword)

    for keyword in search_config.exclude_keywords:
        kw = normalize_text(keyword)
        if kw and (kw in title or kw in description):
            score -= 30
            excluded_keywords.append(keyword)

    if search_config.remote_only:
        if "remote" in location or "remote" in title or "remote" in description:
            score += 15
        else:
            score -= 20

    if search_config.locations:
        normalized_locs = [normalize_text(loc) for loc in search_config.locations]
        if any(loc in location for loc in normalized_locs if loc):
            score += 10

    if search_config.natural_language_override:
        prompt_tokens = normalize_text(search_config.natural_language_override).split()
        overlap = len([t for t in prompt_tokens if t and (t in title or t in description)])
        score += min(20, overlap * 2)

    explanation = {
        "matched_keywords": matched_keywords,
        "excluded_keywords": excluded_keywords,
        "remote_bias": search_config.remote_only,
        "location_match": search_config.locations,
    }
    return score, explanation
