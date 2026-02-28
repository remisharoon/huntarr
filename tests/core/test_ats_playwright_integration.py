from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

import pytest

from huntarr_core.browser.adapters.greenhouse import GreenhouseAdapter
from huntarr_core.browser.adapters.lever import LeverAdapter
from huntarr_core.browser.adapters.workday import WorkdayAdapter

try:
    from playwright.async_api import Page, async_playwright
except Exception:  # pragma: no cover - handled via skip at runtime
    Page = Any  # type: ignore[assignment]
    async_playwright = None  # type: ignore[assignment]


class BrowserUnavailableError(RuntimeError):
    pass


FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "ats"


@pytest.fixture
def profile() -> dict[str, Any]:
    return {
        "full_name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+15551234567",
        "location": "Dubai, UAE",
        "summary": "Backend engineer with Python and distributed systems experience.",
    }


@pytest.fixture
def generated_docs(tmp_path: Path) -> dict[str, str]:
    resume_pdf = tmp_path / "resume.pdf"
    cover_letter = tmp_path / "cover_letter.txt"
    resume_pdf.write_bytes(b"%PDF-1.4\n%fixture\n")
    cover_letter.write_text("Fixture cover letter text.", encoding="utf-8")
    return {"resume_pdf": str(resume_pdf), "cover_letter_txt": str(cover_letter)}


def test_greenhouse_prefill_and_submit(profile: dict[str, Any], generated_docs: dict[str, str]) -> None:
    _run_or_skip(_exercise_greenhouse(profile, generated_docs))


def test_lever_prefill_and_submit(profile: dict[str, Any], generated_docs: dict[str, str]) -> None:
    _run_or_skip(_exercise_lever(profile, generated_docs))


def test_workday_prefill_and_multistep_submit(
    profile: dict[str, Any], generated_docs: dict[str, str]
) -> None:
    _run_or_skip(_exercise_workday(profile, generated_docs))


def _run_or_skip(coro: Any) -> None:
    try:
        asyncio.run(coro)
    except BrowserUnavailableError as exc:
        pytest.skip(f"Playwright browser unavailable for integration test: {exc}")


@asynccontextmanager
async def _open_page() -> AsyncIterator[Page]:
    if async_playwright is None:
        raise BrowserUnavailableError("playwright.async_api import failed")

    async with async_playwright() as playwright:
        try:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()
        except Exception as exc:  # noqa: BLE001
            raise BrowserUnavailableError(str(exc)) from exc

        try:
            yield page
        finally:
            await context.close()
            await browser.close()


def _read_fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


async def _input_value(page: Page, selector: str) -> str:
    return await page.eval_on_selector(selector, "el => el.value")


async def _file_count(page: Page, selector: str) -> int:
    value = await page.eval_on_selector(selector, "el => (el.files ? el.files.length : 0)")
    return int(value)


async def _exercise_greenhouse(profile: dict[str, Any], generated_docs: dict[str, str]) -> None:
    adapter = GreenhouseAdapter()
    async with _open_page() as page:
        await page.set_content(_read_fixture("greenhouse_form.html"))

        result = await adapter.prefill(page, profile, generated_docs)
        assert result.status == "ok"
        assert result.artifacts and result.artifacts["adapter"] == "greenhouse"

        assert await _input_value(page, "#first_name") == "Jane"
        assert await _input_value(page, "#last_name") == "Doe"
        assert await _input_value(page, "#email") == profile["email"]
        assert await _input_value(page, "#phone") == profile["phone"]
        assert await _input_value(page, "#address") == profile["location"]
        assert await _input_value(page, "#cover_letter") == profile["summary"]
        assert await _file_count(page, "input[name='resume']") == 1
        assert await _file_count(page, "input[name='cover_letter']") == 1

        assert await adapter.submit(page) is True
        confirmation = await adapter.extract_confirmation(page)
        assert confirmation is not None
        assert "application submitted" in confirmation.lower()


async def _exercise_lever(profile: dict[str, Any], generated_docs: dict[str, str]) -> None:
    adapter = LeverAdapter()
    async with _open_page() as page:
        await page.set_content(_read_fixture("lever_form.html"))

        result = await adapter.prefill(page, profile, generated_docs)
        assert result.status == "ok"
        assert result.artifacts and result.artifacts["adapter"] == "lever"

        assert await _input_value(page, "#name") == profile["full_name"]
        assert await _input_value(page, "#email") == profile["email"]
        assert await _input_value(page, "#phone") == profile["phone"]
        assert await _input_value(page, "#location") == profile["location"]
        assert await _input_value(page, "#comments") == profile["summary"]
        assert await _file_count(page, "input[name='resume']") == 1
        assert await _file_count(page, "input[name='coverLetter']") == 1

        assert await adapter.submit(page) is True
        confirmation = await adapter.extract_confirmation(page)
        assert confirmation is not None
        assert "thank you" in confirmation.lower()


async def _exercise_workday(profile: dict[str, Any], generated_docs: dict[str, str]) -> None:
    adapter = WorkdayAdapter()
    async with _open_page() as page:
        await page.set_content(_read_fixture("workday_form.html"))

        result = await adapter.prefill(page, profile, generated_docs)
        assert result.status == "ok"
        assert result.artifacts and result.artifacts["adapter"] == "workday"

        assert await _input_value(page, "#wd-first") == "Jane"
        assert await _input_value(page, "#wd-last") == "Doe"
        assert await _input_value(page, "#wd-email") == profile["email"]
        assert await _input_value(page, "#wd-phone") == profile["phone"]
        assert await _input_value(page, "#wd-cover") == profile["summary"]
        assert await _file_count(page, "#wd-resume") == 1

        prefill_next = await page.eval_on_selector("body", "el => el.dataset.prefillNext || ''")
        assert prefill_next == "clicked"

        assert await adapter.submit(page) is True
        submit_step = await page.eval_on_selector("body", "el => el.dataset.submitStep || ''")
        final_submit = await page.eval_on_selector("body", "el => el.dataset.finalSubmit || ''")
        assert submit_step == "clicked"
        assert final_submit == "clicked"

        confirmation = await adapter.extract_confirmation(page)
        assert confirmation is not None
        assert "submitted" in confirmation.lower()
