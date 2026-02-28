from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from playwright.async_api import Page
else:
    Page = Any

from huntarr_core.browser.adapters.base import AdapterResult, AtsAdapter


class GreenhouseAdapter(AtsAdapter):
    name = "greenhouse"

    def matches(self, url: str) -> bool:
        normalized = url.lower()
        return "greenhouse.io" in normalized or "boards.greenhouse.io" in normalized

    async def prefill(
        self,
        page: Page,
        profile: dict[str, Any],
        generated_docs: dict[str, str],
    ) -> AdapterResult:
        full_name = str(profile.get("full_name") or "")
        parts = full_name.split(" ", 1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

        await self._fill_by_selectors(page, ["#first_name", "input[name='first_name']"], first_name)
        await self._fill_by_selectors(page, ["#last_name", "input[name='last_name']"], last_name)
        await self._fill_by_selectors(page, ["#email", "input[name='email']"], str(profile.get("email") or ""))
        await self._fill_by_selectors(page, ["#phone", "input[name='phone']"], str(profile.get("phone") or ""))
        await self._fill_by_selectors(
            page,
            ["#address", "input[name='address']", "input[name='location']"],
            str(profile.get("location") or ""),
        )

        summary = str(profile.get("summary") or "")
        await self._fill_by_selectors(page, ["#cover_letter", "textarea[name='cover_letter']"], summary)

        await self._upload_file(
            page,
            [
                "input[type='file'][name='resume']",
                "input[type='file'][id*='resume' i]",
                "input[type='file'][name*='resume' i]",
            ],
            generated_docs.get("resume_pdf"),
        )
        await self._upload_file(
            page,
            [
                "input[type='file'][name='cover_letter']",
                "input[type='file'][id*='cover' i]",
                "input[type='file'][name*='cover' i]",
            ],
            generated_docs.get("cover_letter_txt"),
        )

        return AdapterResult(status="ok", artifacts={"adapter": self.name})

    async def submit(self, page: Page) -> bool:
        selectors = [
            "#submit_app",
            "button#submit_app",
            "button[type='submit']",
            "button:has-text('Submit Application')",
            "button:has-text('Submit')",
        ]
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.count() and await locator.is_visible(timeout=900):
                    await locator.click(timeout=2000)
                    await page.wait_for_timeout(1400)
                    return True
            except Exception:
                continue
        return False
