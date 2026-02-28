from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from playwright.async_api import Page
else:
    Page = Any

from huntarr_core.browser.adapters.base import AdapterResult, AtsAdapter


class FallbackAdapter(AtsAdapter):
    name = "generic"

    def matches(self, url: str) -> bool:
        return True

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

        await self._fill_by_label(page, ["name", "full name"], full_name)
        await self._fill_by_label(page, ["first name", "given name"], first_name)
        await self._fill_by_label(page, ["last name", "surname", "family name"], last_name)
        await self._fill_by_label(page, ["email", "email address"], str(profile.get("email") or ""))
        await self._fill_by_label(page, ["phone", "mobile", "phone number"], str(profile.get("phone") or ""))
        await self._fill_by_label(page, ["location", "city", "address"], str(profile.get("location") or ""))

        resume_path = generated_docs.get("resume_pdf")
        cover_path = generated_docs.get("cover_letter_txt")

        await self._upload_file(
            page,
            [
                "input[type='file'][name*='resume' i]",
                "input[type='file'][id*='resume' i]",
                "input[type='file']",
            ],
            resume_path,
        )
        await self._upload_file(
            page,
            [
                "input[type='file'][name*='cover' i]",
                "input[type='file'][id*='cover' i]",
            ],
            cover_path,
        )

        return AdapterResult(status="ok", artifacts={"adapter": self.name})
