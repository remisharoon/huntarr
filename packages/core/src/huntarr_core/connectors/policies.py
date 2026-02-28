from __future__ import annotations

from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from huntarr_core.constants import RESTRICTED_PLATFORM_DOMAINS


def is_restricted_platform(url: str) -> bool:
    netloc = urlparse(url).netloc.lower().removeprefix("www.")
    return any(netloc.endswith(domain) for domain in RESTRICTED_PLATFORM_DOMAINS)


def can_use_authenticated_flow(url: str) -> bool:
    return not is_restricted_platform(url)


def robots_allows(url: str, user_agent: str = "huntarr-bot") -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    parser = RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        return True
    return parser.can_fetch(user_agent, url)
