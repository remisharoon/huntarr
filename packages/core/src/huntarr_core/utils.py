from __future__ import annotations

import hashlib
import random
import re
import time
from datetime import UTC, datetime
from urllib.parse import urlparse


def now_utc() -> datetime:
    return datetime.now(UTC)


def normalize_text(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"\s+", " ", value)
    return value


def compute_job_dedupe_hash(title: str, company: str, location: str | None, url: str) -> str:
    parsed = urlparse(url)
    base = "|".join(
        [
            normalize_text(title),
            normalize_text(company),
            normalize_text(location or ""),
            normalize_text(parsed.netloc),
        ]
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def random_delay_seconds(min_s: float = 0.6, max_s: float = 2.2) -> float:
    return random.uniform(min_s, max_s)


def sleep_with_jitter(min_s: float = 0.6, max_s: float = 2.2) -> None:
    time.sleep(random_delay_seconds(min_s, max_s))


def domain_from_url(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")
