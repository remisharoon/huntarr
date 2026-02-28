from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from playwright.async_api import Page
else:
    Page = Any

from huntarr_core.browser.adapters.base import AdapterResult, AtsAdapter


class WorkdayAdapter(AtsAdapter):
    name = "workday"

    def matches(self, url: str) -> bool:
        normalized = url.lower()
        return "myworkdayjobs.com" in normalized or "workday.com" in normalized

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

        await self._fill_by_selectors(
            page,
            [
                "input[data-automation-id='legalNameSection_firstName']",
                "input[name*='firstName' i]",
                "input[aria-label*='First Name' i]",
            ],
            first_name,
        )
        await self._fill_by_selectors(
            page,
            [
                "input[data-automation-id='legalNameSection_lastName']",
                "input[name*='lastName' i]",
                "input[aria-label*='Last Name' i]",
            ],
            last_name,
        )
        await self._fill_by_selectors(
            page,
            [
                "input[data-automation-id='email']",
                "input[type='email']",
                "input[name*='email' i]",
            ],
            str(profile.get("email") or ""),
        )
        await self._fill_by_selectors(
            page,
            [
                "input[data-automation-id='phone-number']",
                "input[type='tel']",
                "input[name*='phone' i]",
            ],
            str(profile.get("phone") or ""),
        )

        await self._upload_file(
            page,
            [
                "input[type='file'][data-automation-id*='file-upload' i]",
                "input[type='file'][name*='resume' i]",
                "input[type='file']",
            ],
            generated_docs.get("resume_pdf"),
        )

        await self._fill_by_selectors(
            page,
            [
                "textarea[data-automation-id='coverLetterText']",
                "textarea[name*='cover' i]",
            ],
            str(profile.get("summary") or ""),
        )

        # Workday forms are multi-step; if next button exists, we continue one step.
        await self._click_first(
            page,
            [
                "button[data-automation-id='bottom-navigation-next-button']",
                "button:has-text('Next')",
            ],
            timeout=1200,
        )

        return AdapterResult(status="ok", artifacts={"adapter": self.name})

    async def submit(self, page: Page) -> bool:
        selectors = [
            "button[data-automation-id='bottom-navigation-next-button'][aria-label*='Submit' i]",
            "button[data-automation-id='bottom-navigation-next-button']",
            "button:has-text('Submit')",
            "button:has-text('Review and Submit')",
        ]
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.count() and await locator.is_visible(timeout=1100):
                    await locator.click(timeout=2500)
                    await page.wait_for_timeout(1700)
                    if "next-button" in selector:
                        # Workday can require a second click on a final submit button.
                        await self._click_first(
                            page,
                            [
                                "button:has-text('Submit')",
                                "button:has-text('Confirm')",
                            ],
                            timeout=900,
                        )
                    return True
            except Exception:
                continue
        return False

    async def _click_first(self, page: Page, selectors: list[str], timeout: int = 900) -> bool:
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if await locator.count() and await locator.is_visible(timeout=timeout):
                    await locator.click(timeout=timeout)
                    await page.wait_for_timeout(900)
                    return True
            except Exception:
                continue
        return False
