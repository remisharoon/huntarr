from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from playwright.async_api import Page
else:
    Page = Any

from huntarr_core.browser.adapters.base import AdapterResult, AtsAdapter


class LeverAdapter(AtsAdapter):
    name = "lever"

    def matches(self, url: str) -> bool:
        normalized = url.lower()
        return "lever.co" in normalized

    async def prefill(
        self,
        page: Page,
        profile: dict[str, Any],
        generated_docs: dict[str, str],
    ) -> AdapterResult:
        full_name = str(profile.get("full_name") or "")

        await self._fill_by_selectors(
            page,
            ["input[name='name']", "input[data-qa='name-input']"],
            full_name,
        )
        await self._fill_by_selectors(
            page,
            ["input[name='email']", "input[data-qa='email-input']"],
            str(profile.get("email") or ""),
        )
        await self._fill_by_selectors(
            page,
            ["input[name='phone']", "input[data-qa='phone-input']"],
            str(profile.get("phone") or ""),
        )
        await self._fill_by_selectors(
            page,
            ["input[name='location']", "input[data-qa='location-input']"],
            str(profile.get("location") or ""),
        )

        summary = str(profile.get("summary") or "")
        await self._fill_by_selectors(
            page,
            ["textarea[name='comments']", "textarea[name='coverLetter']"],
            summary,
        )

        await self._upload_file(
            page,
            [
                "input[type='file'][name='resume']",
                "#resume-upload-input",
                "input[type='file'][name*='resume' i]",
            ],
            generated_docs.get("resume_pdf"),
        )
        await self._upload_file(
            page,
            [
                "input[type='file'][name*='cover' i]",
                "input[type='file'][name='coverLetter']",
            ],
            generated_docs.get("cover_letter_txt"),
        )

        return AdapterResult(status="ok", artifacts={"adapter": self.name})

    async def submit(self, page: Page) -> bool:
        selectors = [
            "button[type='submit']",
            "button:has-text('Submit Application')",
            "button:has-text('Apply')",
        ]
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.count() and await locator.is_visible(timeout=900):
                    await locator.click(timeout=2000)
                    await page.wait_for_timeout(1500)
                    return True
            except Exception:
                continue
        return False
