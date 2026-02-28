from __future__ import annotations

import asyncio
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from playwright.async_api import Page, async_playwright

from huntarr_core.browser.adapters import resolve_adapter
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
        landing_path = screenshot_dir / "landing.png"
        postfill_path = screenshot_dir / "postfill.png"
        result_path = screenshot_dir / "result.png"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            context = await browser.new_context(user_agent=self._randomized_user_agent())
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=50000)
                await self._random_delay(0.9, 1.8)
                await page.screenshot(path=str(landing_path), full_page=True)

                has_captcha = await self._detect_captcha(page)
                if has_captcha:
                    await browser.close()
                    return ApplyResult(
                        status="manual_required",
                        source_portal=domain,
                        failure_code="captcha_detected",
                        needs_manual_action=True,
                        manual_action_type="captcha",
                        artifacts={"landing_screenshot": str(landing_path)},
                    )

                login_hint = await self._detect_login_gate(page)
                if login_hint and is_restricted_platform(url):
                    await browser.close()
                    return ApplyResult(
                        status="skipped",
                        source_portal=domain,
                        failure_code="restricted_platform_login_required",
                        artifacts={"landing_screenshot": str(landing_path)},
                    )

                if login_hint and not can_use_authenticated_flow(url):
                    await browser.close()
                    return ApplyResult(
                        status="skipped",
                        source_portal=domain,
                        failure_code="login_not_allowed",
                        artifacts={"landing_screenshot": str(landing_path)},
                    )

                adapter = resolve_adapter(url)
                adapter_result = await adapter.prefill(page, profile, generated_docs)
                await self._random_delay(0.5, 1.1)
                await page.screenshot(path=str(postfill_path), full_page=True)

                artifacts = {
                    "landing_screenshot": str(landing_path),
                    "postfill_screenshot": str(postfill_path),
                    "adapter": adapter.name,
                }
                if adapter_result.artifacts:
                    artifacts.update(adapter_result.artifacts)

                if adapter_result.needs_manual_action:
                    await browser.close()
                    return ApplyResult(
                        status="manual_required",
                        source_portal=domain,
                        failure_code=adapter_result.failure_code or "adapter_manual_required",
                        needs_manual_action=True,
                        manual_action_type=adapter_result.manual_action_type or "unexpected_form",
                        artifacts=artifacts,
                    )

                has_captcha = await self._detect_captcha(page)
                if has_captcha:
                    await browser.close()
                    return ApplyResult(
                        status="manual_required",
                        source_portal=domain,
                        failure_code="captcha_after_prefill",
                        needs_manual_action=True,
                        manual_action_type="captcha",
                        artifacts=artifacts,
                    )

                if not submit:
                    await browser.close()
                    return ApplyResult(
                        status="in_progress",
                        source_portal=domain,
                        artifacts=artifacts,
                    )

                if os.getenv("AUTO_SUBMIT_ENABLED", "true").lower() != "true":
                    await browser.close()
                    return ApplyResult(
                        status="in_progress",
                        source_portal=domain,
                        artifacts=artifacts,
                    )

                submitted = await adapter.submit(page)
                await self._random_delay(0.7, 1.6)
                await page.screenshot(path=str(result_path), full_page=True)
                artifacts["result_screenshot"] = str(result_path)

                if not submitted:
                    await browser.close()
                    return ApplyResult(
                        status="manual_required",
                        source_portal=domain,
                        failure_code="submit_button_not_found",
                        needs_manual_action=True,
                        manual_action_type="unexpected_form",
                        artifacts=artifacts,
                    )

                confirmation = await adapter.extract_confirmation(page)
                await browser.close()
                return ApplyResult(
                    status="submitted",
                    source_portal=domain,
                    confirmation_text=confirmation,
                    artifacts=artifacts,
                )

            except Exception as exc:  # noqa: BLE001
                await browser.close()
                return ApplyResult(
                    status="failed",
                    source_portal=domain,
                    failure_code=f"playwright_error:{type(exc).__name__}",
                    artifacts={
                        "landing_screenshot": str(landing_path),
                        "adapter": resolve_adapter(url).name,
                    },
                )

    async def _detect_captcha(self, page: Page) -> bool:
        selectors = [
            "iframe[src*='captcha']",
            "iframe[title*='captcha' i]",
            "div.g-recaptcha",
            "#captcha",
            "text=I am not a robot",
            "text=verify you are human",
            "text=Security Check",
        ]
        for selector in selectors:
            try:
                if await page.locator(selector).first.is_visible(timeout=700):
                    return True
            except Exception:
                continue
        return False

    async def _detect_login_gate(self, page: Page) -> bool:
        selectors = [
            "text=Sign in",
            "text=Log in",
            "text=Create account",
            "input[type='password']",
        ]
        for selector in selectors:
            try:
                if await page.locator(selector).first.is_visible(timeout=450):
                    return True
            except Exception:
                continue
        return False

    async def _random_delay(self, min_s: float, max_s: float) -> None:
        await asyncio.sleep(random.uniform(min_s, max_s))

    def _randomized_user_agent(self) -> str:
        candidates = [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        ]
        idx = int(asyncio.get_running_loop().time()) % len(candidates)
        return candidates[idx]
