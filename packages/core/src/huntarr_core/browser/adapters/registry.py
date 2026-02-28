from __future__ import annotations

from huntarr_core.browser.adapters.base import AtsAdapter
from huntarr_core.browser.adapters.fallback import FallbackAdapter
from huntarr_core.browser.adapters.greenhouse import GreenhouseAdapter
from huntarr_core.browser.adapters.lever import LeverAdapter
from huntarr_core.browser.adapters.workday import WorkdayAdapter

_ADAPTERS: list[AtsAdapter] = [
    GreenhouseAdapter(),
    LeverAdapter(),
    WorkdayAdapter(),
    FallbackAdapter(),
]


def resolve_adapter(url: str) -> AtsAdapter:
    for adapter in _ADAPTERS:
        if adapter.matches(url):
            return adapter
    return FallbackAdapter()
