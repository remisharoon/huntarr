from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'apps' / 'api' / 'src'))
sys.path.insert(0, str(ROOT / 'packages' / 'core' / 'src'))

if 'pypdf' not in sys.modules:
    pypdf_stub = types.ModuleType('pypdf')
    class _StubPdfReader:  # pragma: no cover - only used on minimal local environments
        pass
    pypdf_stub.PdfReader = _StubPdfReader
    sys.modules['pypdf'] = pypdf_stub

if 'asyncpg' not in sys.modules:
    asyncpg_stub = types.ModuleType('asyncpg')
    class _StubRecord(dict):  # pragma: no cover - only used on minimal local environments
        pass
    class _StubPool:  # pragma: no cover - only used on minimal local environments
        pass
    async def _stub_create_pool(*_args, **_kwargs):
        raise RuntimeError('asyncpg is not available in this test environment')
    asyncpg_stub.Record = _StubRecord
    asyncpg_stub.Pool = _StubPool
    asyncpg_stub.create_pool = _stub_create_pool
    sys.modules['asyncpg'] = asyncpg_stub

main = pytest.importorskip('huntarr_api.main')


class FakeImage:
    def __init__(self, data: bytes, name: str, width: int = 300, height: int = 320) -> None:
        self.data = data
        self.name = name
        self.width = width
        self.height = height


class FakePage:
    def __init__(self, images: list[FakeImage]) -> None:
        self.images = images


class FakeReader:
    def __init__(self, pages: list[FakePage]) -> None:
        self.pages = pages


def test_parse_resume_fallback_extracts_common_sections() -> None:
    raw_text = """
Jane Doe
jane@example.com
+1 (555) 123-4567
Dubai, UAE

SKILLS
Python, FastAPI, PostgreSQL

EXPERIENCE
Senior Backend Engineer at Acme Corp | 2021 - Present
Built distributed services and API integrations.

EDUCATION
BSc Computer Science - University of Somewhere - 2020

AWARDS
Employee of the Year 2023

LINKS
https://www.linkedin.com/in/janedoe
"""

    parsed = main.parse_resume_fallback(raw_text)

    assert parsed['full_name'] == 'Jane Doe'
    assert parsed['email'] == 'jane@example.com'
    assert parsed['phone']
    assert parsed['skills']
    assert parsed['experience']
    assert parsed['education']
    assert parsed['awards']


def test_normalize_profile_payload_and_summary_generation() -> None:
    payload = {
        'full_name': 'Jane Doe',
        'email': 'jane@example.com',
        'skills': ['Python', 'python', 'FastAPI'],
        'experience': [
            {
                'title': 'Backend Engineer',
                'company': 'Acme',
                'start': '2020',
                'end': 'Present',
                'description': 'API and platform engineering',
            }
        ],
        'education': [{'degree': 'BSc CS', 'institution': 'State University', 'year': '2020'}],
        'certifications': [{'name': 'AWS Certified Developer'}],
        'awards': [{'title': 'Top Performer'}],
    }

    normalized = main.normalize_profile_payload(payload, 'https://github.com/janedoe')
    summary = main.build_professional_summary(normalized)

    assert normalized['skills'] == ['Python', 'FastAPI']
    assert normalized['years_experience'] >= 0
    assert len(normalized['experience']) == 1
    assert normalized['links']
    assert summary
    assert summary.count('.') >= 1


def test_extract_profile_photo_none_when_no_images(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main.settings, 'uploads_root', tmp_path)
    photo_path, photo_mime = main.extract_profile_photo(FakeReader([FakePage([])]), 'resume_input')
    assert photo_path is None
    assert photo_mime is None


def test_extract_profile_photo_picks_embedded_image(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main.settings, 'uploads_root', tmp_path)
    image_data = b'\xff\xd8\xff\xdb\x00C\x00fixture-jpeg-bytes'
    reader = FakeReader([FakePage([FakeImage(image_data, 'avatar.jpg', 600, 700)])])

    photo_path, photo_mime = main.extract_profile_photo(reader, 'resume_input')

    assert photo_path is not None
    assert photo_mime == 'image/jpeg'
    assert Path(photo_path).exists()
