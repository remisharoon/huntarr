from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from playwright.async_api import Page
else:
    Page = Any


@dataclass(slots=True)
class AdapterResult:
    status: str = "ok"
    failure_code: str | None = None
    needs_manual_action: bool = False
    manual_action_type: str | None = None
    artifacts: dict[str, Any] | None = None


class AtsAdapter(ABC):
    name: str = "generic"

    @abstractmethod
    def matches(self, url: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def prefill(
        self,
        page: Page,
        profile: dict[str, Any],
        generated_docs: dict[str, str],
    ) -> AdapterResult:
        raise NotImplementedError

    async def submit(self, page: Page) -> bool:
        selectors = [
            "button[type='submit']",
            "button:has-text('Submit')",
            "button:has-text('Apply')",
            "input[type='submit']",
        ]
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible(timeout=700):
                    await locator.click(timeout=1800)
                    await page.wait_for_timeout(1200)
                    return True
            except Exception:
                continue
        return False

    async def extract_confirmation(self, page: Page) -> str | None:
        selectors = [
            "text=Thank you",
            "text=Application submitted",
            "text=We received your application",
            "text=Your application has been submitted",
        ]
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible(timeout=700):
                    text = await locator.text_content(timeout=700)
                    return text.strip() if text else None
            except Exception:
                continue
        return None

    async def _fill_by_label(self, page: Page, labels: list[str], value: str) -> bool:
        if not value:
            return False
        for label in labels:
            try:
                locator = page.get_by_label(label, exact=False).first
                if await locator.count() and await locator.is_visible(timeout=400):
                    await locator.fill(value, timeout=1200)
                    return True
            except Exception:
                continue
        return False

    async def _fill_by_selectors(self, page: Page, selectors: list[str], value: str) -> bool:
        if not value:
            return False
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.count() and await locator.is_visible(timeout=400):
                    await locator.fill(value, timeout=1200)
                    return True
            except Exception:
                continue
        return False

    async def _upload_file(self, page: Page, selectors: list[str], path: str | None) -> bool:
        if not path:
            return False
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.count() > 0:
                    await locator.set_input_files(path)
                    return True
            except Exception:
                continue
        return False
