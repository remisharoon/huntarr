from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from huntarr_core.connectors.policies import can_use_authenticated_flow, is_restricted_platform


@dataclass(slots=True)
class ApplyResult:
    status: str
    source_portal: str
    failure_code: str | None = None
    confirmation_text: str | None = None
    artifacts: dict[str, Any] | None = None
    needs_manual_action: bool = False
    manual_action_type: str | None = None


class ApplicationEngine:
    def __init__(self, artifact_root: Path):
        self.artifact_root = artifact_root
        self.headless = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"

    async def apply_to_job(
        self,
        run_id: str,
        job: dict[str, Any],
        profile: dict[str, Any],
        generated_docs: dict[str, str],
        submit: bool = True,
    ) -> ApplyResult:
        url = job.get("url") or ""
        domain = urlparse(url).netloc.lower().removeprefix("www.")
        if not url:
            return ApplyResult(status="failed", source_portal=domain or "unknown", failure_code="missing_url")

        screenshot_dir = self.artifact_root / str(run_id) / str(job["id"])
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = screenshot_dir / "landing.png"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context(user_agent=self._randomized_user_agent())
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                await asyncio.sleep(1.2)
                await page.screenshot(path=str(screenshot_path), full_page=True)

                has_captcha = await self._detect_captcha(page)
                if has_captcha:
                    await browser.close()
                    return ApplyResult(
                        status="manual_required",
                        source_portal=domain,
                        failure_code="captcha_detected",
                        needs_manual_action=True,
                        manual_action_type="captcha",
                        artifacts={"landing_screenshot": str(screenshot_path)},
                    )

                login_hint = await self._detect_login_gate(page)
                if login_hint and is_restricted_platform(url):
                    await browser.close()
                    return ApplyResult(
                        status="skipped",
                        source_portal=domain,
                        failure_code="restricted_platform_login_required",
                        artifacts={"landing_screenshot": str(screenshot_path)},
                    )

                if login_hint and not can_use_authenticated_flow(url):
                    await browser.close()
                    return ApplyResult(
                        status="skipped",
                        source_portal=domain,
                        failure_code="login_not_allowed",
                        artifacts={"landing_screenshot": str(screenshot_path)},
                    )

                await self._fill_common_fields(page, profile)
                await self._attach_documents_if_supported(page, generated_docs)

                if has_captcha:
                    await browser.close()
                    return ApplyResult(
                        status="manual_required",
                        source_portal=domain,
                        failure_code="captcha_after_fill",
                        needs_manual_action=True,
                        manual_action_type="captcha",
                        artifacts={"landing_screenshot": str(screenshot_path)},
                    )

                if not submit:
                    await browser.close()
                    return ApplyResult(
                        status="in_progress",
                        source_portal=domain,
                        artifacts={"landing_screenshot": str(screenshot_path)},
                    )

                if os.getenv("AUTO_SUBMIT_ENABLED", "true").lower() == "true":
                    submitted = await self._submit_if_possible(page)
                    confirmation = None
                    if submitted:
                        confirmation = await self._extract_confirmation(page)
                    await browser.close()
                    return ApplyResult(
                        status="submitted" if submitted else "manual_required",
                        source_portal=domain,
                        failure_code=None if submitted else "submit_button_not_found",
                        confirmation_text=confirmation,
                        needs_manual_action=not submitted,
                        manual_action_type=None if submitted else "unexpected_form",
                        artifacts={"landing_screenshot": str(screenshot_path)},
                    )

                await browser.close()
                return ApplyResult(
                    status="in_progress",
                    source_portal=domain,
                    artifacts={"landing_screenshot": str(screenshot_path)},
                )

            except Exception as exc:  # noqa: BLE001
                await browser.close()
                return ApplyResult(
                    status="failed",
                    source_portal=domain,
                    failure_code=f"playwright_error:{type(exc).__name__}",
                    artifacts={"landing_screenshot": str(screenshot_path)},
                )

    async def _detect_captcha(self, page: Page) -> bool:
        selectors = [
            "iframe[src*='captcha']",
            "div.g-recaptcha",
            "#captcha",
            "text=I am not a robot",
            "text=verify you are human",
        ]
        for selector in selectors:
            try:
                if await page.locator(selector).first.is_visible(timeout=500):
                    return True
            except Exception:
                continue
        return False

    async def _detect_login_gate(self, page: Page) -> bool:
        selectors = ["text=Sign in", "text=Log in", "input[type='password']"]
        for selector in selectors:
            try:
                if await page.locator(selector).first.is_visible(timeout=350):
                    return True
            except Exception:
                continue
        return False

    async def _fill_common_fields(self, page: Page, profile: dict[str, Any]) -> None:
        text_map = {
            "name": profile.get("full_name", ""),
            "full name": profile.get("full_name", ""),
            "email": profile.get("email", ""),
            "phone": profile.get("phone", ""),
            "location": profile.get("location", ""),
        }

        for label, value in text_map.items():
            if not value:
                continue
            try:
                locator = page.get_by_label(label, exact=False)
                if await locator.count() > 0:
                    await locator.first.fill(str(value), timeout=900)
            except Exception:
                continue

    async def _attach_documents_if_supported(self, page: Page, docs: dict[str, str]) -> None:
        file_fields = page.locator("input[type='file']")
        count = await file_fields.count()
        for idx in range(count):
            field = file_fields.nth(idx)
            field_name = (await field.get_attribute("name") or "").lower()
            target = docs.get("resume_pdf")
            if "cover" in field_name:
                target = docs.get("cover_letter_txt")
            if target:
                try:
                    await field.set_input_files(target)
                except Exception:
                    continue

    async def _submit_if_possible(self, page: Page) -> bool:
        candidates = ["button:has-text('Submit')", "button:has-text('Apply')", "input[type='submit']"]
        for selector in candidates:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible(timeout=400):
                    await locator.click(timeout=1500)
                    await asyncio.sleep(1.0)
                    return True
            except Exception:
                continue
        return False

    async def _extract_confirmation(self, page: Page) -> str | None:
        texts = [
            "text=Thank you",
            "text=Application submitted",
            "text=We received your application",
        ]
        for selector in texts:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible(timeout=500):
                    return await locator.text_content(timeout=500)
            except Exception:
                continue
        return None

    def _randomized_user_agent(self) -> str:
        candidates = [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        ]
        idx = int(asyncio.get_running_loop().time()) % len(candidates)
        return candidates[idx]
