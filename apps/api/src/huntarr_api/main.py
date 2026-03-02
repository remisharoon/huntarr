from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from croniter import croniter
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pypdf import PdfReader
from sse_starlette.sse import EventSourceResponse

from huntarr_api.config import settings
from huntarr_api.llm_providers import (
    LLM_PROVIDER_VAULT_DOMAIN,
    activate_provider,
    create_provider,
    delete_provider as delete_llm_provider,
    get_provider,
    list_provider_summaries,
    resolve_active_runtime_config,
    resolve_provider_api_key,
    update_provider,
)
from huntarr_api.schemas import (
    ApplicationDetailResponse,
    ConfigPayload,
    CredentialPayload,
    HealthResponse,
    JobDetailResponse,
    LLMProviderCreatePayload,
    LLMProviderTestPayload,
    LLMProviderUpdatePayload,
    ManualActionResolveRequest,
    ManualSessionStartResponse,
    ProfilePayload,
    RunCreateRequest,
    ScheduleCreateRequest,
)
from huntarr_core.constants import DEFAULT_QUEUE_NAME
from huntarr_core.db.pool import create_db_pool, init_db_schema
from huntarr_core.db.repo import HuntRepo
from huntarr_core.vault import decrypt_secret, encrypt_secret

app = FastAPI(title='Huntarr API', version='0.1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


db_pool = None
repo: HuntRepo | None = None


@app.on_event('startup')
async def startup() -> None:
    global db_pool, repo
    settings.uploads_root.mkdir(parents=True, exist_ok=True)
    settings.artifact_root.mkdir(parents=True, exist_ok=True)

    db_pool = await create_db_pool(settings.database_url)
    await init_db_schema(db_pool)
    repo = HuntRepo(db_pool)
    await repo.ensure_default_profile()


@app.on_event('shutdown')
async def shutdown() -> None:
    global db_pool
    if db_pool is not None:
        await db_pool.close()


def get_repo() -> HuntRepo:
    if repo is None:
        raise RuntimeError('Repository not ready')
    return repo


SECTION_ALIASES: dict[str, tuple[str, ...]] = {
    'experience': ('experience', 'work experience', 'professional experience', 'employment history'),
    'education': ('education', 'academic background'),
    'skills': ('skills', 'technical skills', 'core skills', 'competencies'),
    'awards': ('awards', 'honors', 'achievements'),
    'certifications': ('certifications', 'certificates', 'licenses'),
    'projects': ('projects', 'selected projects'),
    'languages': ('languages', 'language proficiency'),
    'links': ('links', 'profiles', 'portfolio', 'websites'),
    'summary': ('summary', 'professional summary', 'profile', 'about'),
}

EMAIL_RE = re.compile(r'[\w.\-+%]+@[\w.\-]+\.[A-Za-z]{2,}')
PHONE_RE = re.compile(r'(?:(?:\+?\d)[\d\s().\-]{7,}\d)')
YEAR_RE = re.compile(r'(?:19|20)\d{2}')
YEAR_RANGE_RE = re.compile(
    r'((?:19|20)\d{2})\s*[-–]\s*(present|current|now|(?:19|20)\d{2})',
    re.IGNORECASE,
)
URL_RE = re.compile(r'https?://[^\s)>\]]+')


def _safe_file_stem(value: str) -> str:
    stem = re.sub(r'[^A-Za-z0-9._-]+', '_', value).strip('._')
    return stem or 'resume'


def _safe_upload_path(filename: str, suffix: str | None = None) -> Path:
    base_name = Path(filename).name or 'resume.pdf'
    stem = _safe_file_stem(Path(base_name).stem)
    ext = Path(base_name).suffix.lower() or '.pdf'
    marker = suffix or uuid4().hex[:8]
    return settings.uploads_root / f'{stem}_{marker}{ext}'


def _is_within_root(path: Path, root: Path) -> bool:
    resolved_path = path.resolve()
    resolved_root = root.resolve()
    try:
        resolved_path.relative_to(resolved_root)
        return True
    except ValueError:
        return False


async def _save_uploaded_file(file: UploadFile) -> Path:
    file_path = _safe_upload_path(file.filename or 'resume.pdf')
    content = await file.read()
    file_path.write_bytes(content)
    return file_path


def extract_pdf_text(reader: PdfReader) -> str:
    return '\n'.join(page.extract_text() or '' for page in reader.pages)


def _section_key(line: str) -> str | None:
    normalized = re.sub(r'[:\s]+', ' ', line.strip().lower()).strip()
    if not normalized:
        return None
    for key, aliases in SECTION_ALIASES.items():
        if normalized in aliases:
            return key
    return None


def _clean_text(value: Any) -> str:
    if value is None:
        return ''
    text = str(value).strip()
    return re.sub(r'\s+', ' ', text)


def _coerce_int(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return max(value, 0)
    if isinstance(value, float):
        return max(int(value), 0)
    text = _clean_text(value)
    if not text:
        return 0
    match = re.search(r'\d+', text)
    if not match:
        return 0
    return max(int(match.group(0)), 0)


def _coerce_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        return [part.strip() for part in re.split(r'[,;\n•|]', value) if part.strip()]
    return []


def _dedupe_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        cleaned = _clean_text(value)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)
    return deduped


def _normalize_skills(value: Any) -> list[str]:
    return _dedupe_strings([_clean_text(item) for item in _coerce_list(value)])


def _normalize_experience(value: Any) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in _coerce_list(value):
        if isinstance(item, dict):
            row = {
                'title': _clean_text(item.get('title') or item.get('role')),
                'company': _clean_text(item.get('company') or item.get('organization')),
                'start': _clean_text(item.get('start') or item.get('from')),
                'end': _clean_text(item.get('end') or item.get('to')),
                'description': _clean_text(item.get('description') or item.get('summary') or item.get('details')),
            }
        else:
            text = _clean_text(item)
            row = {'title': '', 'company': '', 'start': '', 'end': '', 'description': text}
        if any(row.values()):
            rows.append(row)
    return rows


def _normalize_education(value: Any) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in _coerce_list(value):
        if isinstance(item, dict):
            row = {
                'degree': _clean_text(item.get('degree') or item.get('qualification')),
                'institution': _clean_text(item.get('institution') or item.get('school') or item.get('university')),
                'year': _clean_text(item.get('year') or item.get('graduation_year')),
                'description': _clean_text(item.get('description') or item.get('details')),
            }
        else:
            text = _clean_text(item)
            row = {'degree': text, 'institution': '', 'year': '', 'description': ''}
        if any(row.values()):
            rows.append(row)
    return rows


def _normalize_awards(value: Any) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in _coerce_list(value):
        if isinstance(item, dict):
            row = {
                'title': _clean_text(item.get('title') or item.get('name')),
                'issuer': _clean_text(item.get('issuer') or item.get('organization')),
                'year': _clean_text(item.get('year')),
                'description': _clean_text(item.get('description') or item.get('details')),
            }
        else:
            text = _clean_text(item)
            row = {'title': text, 'issuer': '', 'year': '', 'description': ''}
        if any(row.values()):
            rows.append(row)
    return rows


def _normalize_certifications(value: Any) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in _coerce_list(value):
        if isinstance(item, dict):
            row = {
                'name': _clean_text(item.get('name') or item.get('title')),
                'issuer': _clean_text(item.get('issuer') or item.get('organization')),
                'year': _clean_text(item.get('year')),
                'credential_id': _clean_text(item.get('credential_id') or item.get('id')),
                'url': _clean_text(item.get('url')),
            }
        else:
            text = _clean_text(item)
            row = {'name': text, 'issuer': '', 'year': '', 'credential_id': '', 'url': ''}
        if any(row.values()):
            rows.append(row)
    return rows


def _normalize_projects(value: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in _coerce_list(value):
        if isinstance(item, dict):
            row = {
                'name': _clean_text(item.get('name') or item.get('title')),
                'role': _clean_text(item.get('role')),
                'start': _clean_text(item.get('start') or item.get('from')),
                'end': _clean_text(item.get('end') or item.get('to')),
                'description': _clean_text(item.get('description') or item.get('summary') or item.get('details')),
                'url': _clean_text(item.get('url')),
                'tech_stack': _normalize_skills(item.get('tech_stack') or item.get('technologies')),
            }
        else:
            text = _clean_text(item)
            row = {
                'name': text,
                'role': '',
                'start': '',
                'end': '',
                'description': '',
                'url': '',
                'tech_stack': [],
            }
        if row['name'] or row['description'] or row['url']:
            rows.append(row)
    return rows


def _normalize_languages(value: Any) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in _coerce_list(value):
        if isinstance(item, dict):
            row = {
                'name': _clean_text(item.get('name') or item.get('language')),
                'proficiency': _clean_text(item.get('proficiency') or item.get('level')),
            }
        else:
            text = _clean_text(item)
            if '(' in text and text.endswith(')'):
                name, _, prof = text[:-1].partition('(')
                row = {'name': _clean_text(name), 'proficiency': _clean_text(prof)}
            else:
                row = {'name': text, 'proficiency': ''}
        if any(row.values()):
            rows.append(row)
    return rows


def _normalize_links(value: Any) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in _coerce_list(value):
        if isinstance(item, dict):
            row = {'label': _clean_text(item.get('label') or item.get('name')), 'url': _clean_text(item.get('url'))}
        else:
            text = _clean_text(item)
            urls = URL_RE.findall(text)
            if urls:
                row = {'label': '', 'url': urls[0]}
            else:
                row = {'label': text, 'url': ''}
        if row['url'] or row['label']:
            rows.append(row)

    deduped: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in rows:
        key = (row.get('url') or row.get('label')).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def _strip_code_fences(value: str) -> str:
    text = value.strip()
    if text.startswith('```'):
        parts = text.split('```')
        if len(parts) >= 2:
            text = parts[1]
        text = text.removeprefix('json').strip()
    return text


def _extract_first_json_object(value: str) -> str:
    raw = _strip_code_fences(value)
    start = raw.find('{')
    end = raw.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return raw
    return raw[start : end + 1]


def parse_resume_fallback(raw_text: str) -> dict[str, Any]:
    raw_lines = [line.rstrip() for line in raw_text.splitlines()]
    non_empty = [line.strip() for line in raw_lines if line.strip()]
    sections: dict[str, list[str]] = {'header': []}
    current_section = 'header'

    for raw_line in raw_lines:
        line = raw_line.strip()
        if not line:
            if sections.get(current_section):
                sections[current_section].append('')
            continue

        section = _section_key(line)
        if section:
            current_section = section
            sections.setdefault(section, [])
            continue
        sections.setdefault(current_section, []).append(line)

    def chunk_lines(lines: list[str]) -> list[list[str]]:
        chunks: list[list[str]] = []
        current: list[str] = []
        for line in lines:
            if not line:
                if current:
                    chunks.append(current)
                    current = []
                continue
            is_entry_start = bool(YEAR_RANGE_RE.search(line) or re.search(r'\b at \b| \| ', line, re.IGNORECASE))
            if current and is_entry_start and len(current) >= 2:
                chunks.append(current)
                current = [line]
                continue
            current.append(line)
        if current:
            chunks.append(current)
        return chunks

    experience: list[dict[str, str]] = []
    for chunk in chunk_lines(sections.get('experience', [])):
        headline = chunk[0]
        title = headline
        company = ''
        if ' at ' in headline.lower():
            left, _, right = headline.partition(' at ')
            title, company = _clean_text(left), _clean_text(right)
        elif ' | ' in headline:
            left, _, right = headline.partition(' | ')
            title, company = _clean_text(left), _clean_text(right)
        year_match = YEAR_RANGE_RE.search(' '.join(chunk))
        experience.append(
            {
                'title': _clean_text(title),
                'company': _clean_text(company),
                'start': year_match.group(1) if year_match else '',
                'end': year_match.group(2) if year_match else '',
                'description': _clean_text(' '.join(chunk[1:]))[:1000],
            }
        )

    education: list[dict[str, str]] = []
    for chunk in chunk_lines(sections.get('education', [])):
        headline = chunk[0]
        year_match = YEAR_RE.search(' '.join(chunk))
        if ' - ' in headline:
            degree, _, institution = headline.partition(' - ')
        elif ' | ' in headline:
            degree, _, institution = headline.partition(' | ')
        else:
            degree, institution = headline, ''
        education.append(
            {
                'degree': _clean_text(degree),
                'institution': _clean_text(institution),
                'year': year_match.group(0) if year_match else '',
                'description': _clean_text(' '.join(chunk[1:]))[:600],
            }
        )

    awards = [{'title': _clean_text(line), 'issuer': '', 'year': '', 'description': ''} for line in sections.get('awards', []) if line]
    certifications = [{'name': _clean_text(line), 'issuer': '', 'year': '', 'credential_id': '', 'url': ''} for line in sections.get('certifications', []) if line]
    projects = [{'name': _clean_text(line), 'role': '', 'start': '', 'end': '', 'description': '', 'url': '', 'tech_stack': []} for line in sections.get('projects', []) if line]
    languages = [{'name': _clean_text(line), 'proficiency': ''} for line in sections.get('languages', []) if line]
    links = [{'label': '', 'url': url} for url in URL_RE.findall(raw_text)]
    links.extend({'label': _clean_text(line), 'url': ''} for line in sections.get('links', []) if line and not URL_RE.search(line))

    inferred_name = ''
    for line in non_empty[:5]:
        if EMAIL_RE.search(line) or PHONE_RE.search(line):
            continue
        if len(line.split()) > 5:
            continue
        if re.search(r'\d', line):
            continue
        inferred_name = line
        break

    email_match = EMAIL_RE.search(raw_text)
    phone_match = PHONE_RE.search(raw_text)
    location_guess = next(
        (
            line
            for line in non_empty
            if ',' in line and not EMAIL_RE.search(line) and len(line) < 80
        ),
        '',
    )

    return {
        'full_name': inferred_name,
        'email': email_match.group(0) if email_match else '',
        'phone': phone_match.group(0) if phone_match else '',
        'location': location_guess,
        'skills': sections.get('skills', []),
        'experience': experience,
        'education': education,
        'awards': awards,
        'certifications': certifications,
        'projects': projects,
        'languages': languages,
        'links': links,
        'summary': _clean_text(' '.join(sections.get('summary', [])))[:1200],
    }


async def parse_resume_with_llm(raw_text: str, llm_runtime: dict[str, Any] | None) -> dict[str, Any] | None:
    if not llm_runtime or not llm_runtime.get('api_key'):
        return None
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=llm_runtime['api_key'],
            base_url=llm_runtime['base_url'],
        )
        prompt = (
            'You are a resume parser. Return only JSON.\n'
            'Extract as much information as possible from the resume text.\n'
            'Schema:\n'
            '{\n'
            '  "full_name": "...",\n'
            '  "email": "...",\n'
            '  "phone": "...",\n'
            '  "location": "...",\n'
            '  "years_experience": 0,\n'
            '  "skills": ["..."],\n'
            '  "experience": [{"title":"...", "company":"...", "start":"...", "end":"...", "description":"..."}],\n'
            '  "education": [{"degree":"...", "institution":"...", "year":"...", "description":"..."}],\n'
            '  "awards": [{"title":"...", "issuer":"...", "year":"...", "description":"..."}],\n'
            '  "certifications": [{"name":"...", "issuer":"...", "year":"...", "credential_id":"...", "url":"..."}],\n'
            '  "projects": [{"name":"...", "role":"...", "start":"...", "end":"...", "description":"...", "url":"...", "tech_stack":["..."]}],\n'
            '  "languages": [{"name":"...", "proficiency":"..."}],\n'
            '  "links": [{"label":"...", "url":"..."}],\n'
            '  "summary": "..."\n'
            '}\n'
            'Use empty arrays when section is not found.\n\n'
            f'Resume text:\n{raw_text[:12000]}'
        )
        response = await client.chat.completions.create(
            model=llm_runtime['model'],
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0,
        )
        raw_json = response.choices[0].message.content or '{}'
        return json.loads(_extract_first_json_object(raw_json))
    except Exception as exc:
        print(f'[import-resume] LLM extraction failed: {exc}')
        return None


def normalize_profile_payload(parsed: dict[str, Any] | None, raw_text: str) -> dict[str, Any]:
    payload = parsed or {}
    normalized = {
        'full_name': _clean_text(payload.get('full_name')),
        'email': _clean_text(payload.get('email')),
        'phone': _clean_text(payload.get('phone')),
        'location': _clean_text(payload.get('location')),
        'years_experience': _coerce_int(payload.get('years_experience')),
        'summary': _clean_text(payload.get('summary')),
        'skills': _normalize_skills(payload.get('skills')),
        'experience': _normalize_experience(payload.get('experience')),
        'education': _normalize_education(payload.get('education')),
        'awards': _normalize_awards(payload.get('awards')),
        'certifications': _normalize_certifications(payload.get('certifications')),
        'projects': _normalize_projects(payload.get('projects')),
        'languages': _normalize_languages(payload.get('languages')),
        'links': _normalize_links(payload.get('links')),
        'profile_photo_path': _clean_text(payload.get('profile_photo_path')) or None,
        'profile_photo_mime': _clean_text(payload.get('profile_photo_mime')) or None,
    }

    if not normalized['email']:
        email_match = EMAIL_RE.search(raw_text)
        normalized['email'] = email_match.group(0) if email_match else ''
    if not normalized['phone']:
        phone_match = PHONE_RE.search(raw_text)
        normalized['phone'] = phone_match.group(0) if phone_match else ''

    if not normalized['links']:
        normalized['links'] = [{'label': '', 'url': url} for url in URL_RE.findall(raw_text)]

    if normalized['years_experience'] <= 0:
        years: list[int] = []
        for item in normalized['experience']:
            for source in (item.get('start', ''), item.get('description', '')):
                for match in YEAR_RE.findall(source or ''):
                    years.append(int(match))
        current_year = datetime.utcnow().year
        if years:
            normalized['years_experience'] = max(0, min(50, current_year - min(years)))

    return normalized


def build_professional_summary(profile: dict[str, Any]) -> str:
    full_name = _clean_text(profile.get('full_name'))
    years = _coerce_int(profile.get('years_experience'))
    skills = _normalize_skills(profile.get('skills'))[:5]
    experience = _normalize_experience(profile.get('experience'))
    education = _normalize_education(profile.get('education'))
    certifications = _normalize_certifications(profile.get('certifications'))
    awards = _normalize_awards(profile.get('awards'))

    lead = experience[0] if experience else {}
    role = _clean_text(lead.get('title'))
    company = _clean_text(lead.get('company'))
    subject = full_name or 'Candidate'

    sentences: list[str] = []
    if role and years > 0:
        company_suffix = f', most recently at {company}' if company else ''
        sentences.append(f'{subject} is a {role} with {years}+ years of professional experience{company_suffix}.')
    elif role:
        company_suffix = f' at {company}' if company else ''
        sentences.append(f'{subject} is a {role}{company_suffix} with a strong delivery track record.')
    elif years > 0:
        sentences.append(f'{subject} brings {years}+ years of hands-on professional experience across technical roles.')

    if skills:
        sentences.append(f'Core strengths include {", ".join(skills)}.')

    edu = education[0] if education else {}
    edu_text = ' '.join(part for part in [_clean_text(edu.get('degree')), _clean_text(edu.get('institution'))] if part).strip()
    cert = certifications[0] if certifications else {}
    award = awards[0] if awards else {}
    achievements: list[str] = []
    if edu_text:
        achievements.append(f'education in {edu_text}')
    if cert.get('name'):
        achievements.append(f'certification: {cert["name"]}')
    if award.get('title'):
        achievements.append(f'award recognition: {award["title"]}')
    if achievements:
        sentences.append(f'Highlights include {"; ".join(achievements)}.')

    if not sentences:
        sentences.append('Candidate brings relevant experience and practical technical strengths for modern software teams.')
    if len(sentences) == 1:
        sentences.append('Profile details are synthesized from resume education, professional history, and core skills.')

    return ' '.join(sentences[:4])[:1200]


def _guess_image_type(data: bytes, name: str = '') -> tuple[str, str]:
    lower_name = (name or '').lower()
    if lower_name.endswith(('.jpg', '.jpeg')):
        return '.jpg', 'image/jpeg'
    if lower_name.endswith('.png'):
        return '.png', 'image/png'
    if lower_name.endswith('.webp'):
        return '.webp', 'image/webp'
    if lower_name.endswith('.gif'):
        return '.gif', 'image/gif'

    if data.startswith(b'\xff\xd8\xff'):
        return '.jpg', 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png', 'image/png'
    if data.startswith(b'RIFF') and b'WEBP' in data[:16]:
        return '.webp', 'image/webp'
    if data.startswith(b'GIF87a') or data.startswith(b'GIF89a'):
        return '.gif', 'image/gif'
    return '.bin', 'application/octet-stream'


def extract_profile_photo(reader: PdfReader, source_stem: str) -> tuple[str | None, str | None]:
    best_candidate: tuple[int, bytes, str] | None = None
    for page_idx, page in enumerate(reader.pages):
        try:
            images = getattr(page, 'images', None)
        except Exception:
            images = None
        if not images:
            continue

        if isinstance(images, dict):
            iterator = images.values()
        else:
            iterator = images

        for image_obj in iterator:
            data = getattr(image_obj, 'data', None)
            if not data and isinstance(image_obj, dict):
                data = image_obj.get('data')
            if data is None:
                continue
            if not isinstance(data, (bytes, bytearray)):
                try:
                    data = bytes(data)
                except Exception:
                    continue

            name = _clean_text(getattr(image_obj, 'name', '')) or 'image'
            width = getattr(image_obj, 'width', None)
            height = getattr(image_obj, 'height', None)
            nested_image = getattr(image_obj, 'image', None)
            if nested_image is not None:
                width = width or getattr(nested_image, 'width', None)
                height = height or getattr(nested_image, 'height', None)

            size_score = min(300, int(len(data) / 2500))
            page_score = 450 if page_idx == 0 else 220 if page_idx == 1 else 0
            shape_score = 0
            if width and height:
                ratio = max(width, height) / max(1, min(width, height))
                if ratio <= 1.35:
                    shape_score = 220
                elif ratio <= 1.8:
                    shape_score = 130
                else:
                    shape_score = 30

            score = page_score + size_score + shape_score
            if best_candidate is None or score > best_candidate[0]:
                best_candidate = (score, bytes(data), name)

    if not best_candidate:
        return None, None

    _, payload, image_name = best_candidate
    ext, mime = _guess_image_type(payload, image_name)
    if mime == 'application/octet-stream':
        return None, None

    target = settings.uploads_root / f'{_safe_file_stem(source_stem)}_photo_{uuid4().hex[:8]}{ext}'
    try:
        target.write_bytes(payload)
    except Exception:
        return None, None
    return str(target), mime


@app.get('/api/health', response_model=HealthResponse)
async def health() -> HealthResponse:
    heartbeat = await get_repo().heartbeat()
    return HealthResponse(status='ok', database_time=heartbeat['now'])


@app.post('/api/runs')
async def create_run(payload: RunCreateRequest) -> dict[str, Any]:
    repository = get_repo()
    run = await repository.create_run(payload.mode, payload.search_config)
    await repository.enqueue_job(
        payload={'type': 'run_hunt', 'run_id': str(run['id'])},
        run_id=run['id'],
        queue_name=DEFAULT_QUEUE_NAME,
    )
    await repository.insert_run_event(
        run['id'],
        'info',
        'api',
        'run_created',
        'Run created and queued',
        {'mode': payload.mode},
    )
    return run


@app.get('/api/runs')
async def list_runs(limit: int = Query(default=50, ge=1, le=500)) -> dict[str, Any]:
    runs = await get_repo().list_runs(limit=limit)
    return {'items': runs}


@app.get('/api/runs/{run_id}')
async def get_run(run_id: UUID) -> dict[str, Any]:
    run = await get_repo().fetch_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found')
    return run


@app.post('/api/runs/{run_id}/pause')
async def pause_run(run_id: UUID) -> dict[str, Any]:
    repository = get_repo()
    run = await repository.fetch_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found')
    await repository.update_run_status(run_id, 'paused', current_node='manual_pause')
    await repository.insert_run_event(run_id, 'warning', 'api', 'run_paused', 'Run paused by user')
    return {'id': run_id, 'status': 'paused'}


@app.post('/api/runs/{run_id}/resume')
async def resume_run(run_id: UUID) -> dict[str, Any]:
    repository = get_repo()
    run = await repository.fetch_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail='Run not found')

    await repository.clear_run_error(run_id)
    state = await repository.get_run_state(run_id)
    state['pause_requested'] = False
    state['challenge_detected'] = False
    state['manual_action_id'] = None
    await repository.save_run_state(run_id, state, current_node='resume_requested')
    await repository.update_run_status(run_id, 'queued', current_node='resume_requested')
    await repository.enqueue_job(payload={'type': 'run_hunt', 'run_id': str(run_id)}, run_id=run_id)
    await repository.insert_run_event(run_id, 'info', 'api', 'run_resumed', 'Run resumed and re-queued')
    return {'id': run_id, 'status': 'queued'}


@app.get('/api/runs/{run_id}/events')
async def run_events(run_id: UUID, after_id: int = Query(default=0)) -> EventSourceResponse:
    repository = get_repo()

    async def event_generator():
        cursor = after_id
        while True:
            events = await repository.fetch_run_events(run_id, after_id=cursor, limit=100)
            if events:
                for evt in events:
                    cursor = int(evt['id'])
                    data = {
                        'id': evt['id'],
                        'run_id': str(evt['run_id']),
                        'ts': evt['ts'].isoformat(),
                        'level': evt['level'],
                        'node': evt['node'],
                        'event_type': evt['event_type'],
                        'message': evt['message'],
                        'payload_json': evt['payload_json'],
                    }
                    yield {
                        'id': str(evt['id']),
                        'event': 'run_event',
                        'data': json.dumps(data),
                    }
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@app.get('/api/runs/{run_id}/events/batch')
async def run_events_batch(
    run_id: UUID,
    after_id: int = Query(default=0),
    limit: int = Query(default=50, ge=1, le=250),
) -> list[dict[str, Any]]:
    events = await get_repo().fetch_run_events(run_id, after_id=after_id, limit=limit)
    return events


@app.get('/api/jobs')
async def list_jobs(limit: int = Query(default=200, ge=1, le=500)) -> dict[str, Any]:
    jobs = await get_repo().list_jobs(limit=limit)
    return {'items': jobs}


@app.get('/api/jobs/{job_id}', response_model=JobDetailResponse)
async def get_job(job_id: UUID) -> dict[str, Any]:
    job = await get_repo().get_job_with_details(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return job


@app.post('/api/jobs/{job_id}/apply-now')
async def apply_now(job_id: UUID) -> dict[str, Any]:
    repository = get_repo()
    job = await repository.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')

    run = await repository.create_run(mode='manual', search_config={'max_jobs_per_run': 1, 'target_job_id': str(job_id)})
    state = {
        'selected_jobs': [job],
        'candidate_jobs': [job],
        'job_cursor': 0,
        'search_config': {'max_jobs_per_run': 1, 'target_job_id': str(job_id)},
    }
    await repository.save_run_state(run['id'], state)
    await repository.enqueue_job(payload={'type': 'run_hunt', 'run_id': str(run['id'])}, run_id=run['id'])
    return {'run_id': run['id'], 'queued_job_id': job_id}


@app.get('/api/applications')
async def list_applications(limit: int = Query(default=200, ge=1, le=500)) -> dict[str, Any]:
    apps = await get_repo().list_applications(limit=limit)
    return {'items': apps}


@app.get('/api/applications/{application_id}', response_model=ApplicationDetailResponse)
async def get_application(application_id: UUID) -> dict[str, Any]:
    app = await get_repo().get_application_with_details(application_id)
    if not app:
        raise HTTPException(status_code=404, detail='Application not found')
    return app


@app.get('/api/manual-actions')
async def list_manual_actions(status: str | None = None) -> dict[str, Any]:
    items = await get_repo().list_manual_actions(status=status)
    return {'items': items}


@app.post('/api/manual-actions/{action_id}/start-session', response_model=ManualSessionStartResponse)
async def start_manual_session(action_id: UUID) -> ManualSessionStartResponse:
    repository = get_repo()
    updated = await repository.update_manual_action_session(
        action_id,
        status='in_progress',
        session_url=settings.manual_session_url,
    )
    if not updated:
        raise HTTPException(status_code=404, detail='Manual action not found')
    return ManualSessionStartResponse(
        id=updated['id'],
        status=updated['status'],
        session_url=updated.get('session_url') or settings.manual_session_url,
    )


@app.post('/api/manual-actions/{action_id}/resolve')
async def resolve_manual_action(action_id: UUID, payload: ManualActionResolveRequest) -> dict[str, Any]:
    repository = get_repo()
    action = await repository.resolve_manual_action(action_id, payload.status, payload.details)
    if not action:
        raise HTTPException(status_code=404, detail='Manual action not found')

    if payload.status == 'resolved':
        state = await repository.get_run_state(action['run_id'])
        state['pause_requested'] = False
        state['challenge_detected'] = False
        state['manual_action_id'] = None
        await repository.save_run_state(action['run_id'], state, current_node='manual_action_resolved')
        await repository.update_run_status(action['run_id'], 'queued', current_node='manual_action_resolved')
        await repository.enqueue_job(
            payload={'type': 'run_hunt', 'run_id': str(action['run_id'])},
            run_id=action['run_id'],
        )
    return action


@app.get('/api/profile')
async def get_profile() -> dict[str, Any]:
    profile = await get_repo().get_latest_profile()
    if not profile:
        raise HTTPException(status_code=404, detail='Profile not found')
    prefs = await get_repo().get_search_preferences(profile['id'])
    profile['rule_config'] = prefs.get('rule_config', {}) if prefs else {}
    profile['natural_language_override'] = prefs.get('natural_language_override') if prefs else None
    return profile


@app.put('/api/profile')
async def upsert_profile(payload: ProfilePayload) -> dict[str, Any]:
    repository = get_repo()
    profile = await repository.upsert_profile(payload.model_dump())
    await repository.upsert_search_preferences(
        UUID(str(profile['id'])),
        payload.rule_config,
        payload.natural_language_override,
    )
    return profile


@app.post('/api/profile/resume-upload')
async def upload_resume(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail='Missing file name')
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail='Only PDF supported for MVP')

    file_path = await _save_uploaded_file(file)
    return {'path': str(file_path), 'size': file_path.stat().st_size}


@app.post('/api/profile/parse-resume')
async def parse_resume(path: str = Query(..., description='Absolute path from resume-upload response')) -> dict[str, Any]:
    file_path = Path(path)
    if not _is_within_root(file_path, settings.uploads_root):
        raise HTTPException(status_code=400, detail='Path must be inside uploads root')
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='Resume not found')

    reader = PdfReader(str(file_path))
    raw_text = extract_pdf_text(reader)
    fallback = parse_resume_fallback(raw_text)
    normalized = normalize_profile_payload(fallback, raw_text)
    normalized['summary'] = build_professional_summary(normalized)
    normalized['raw_text_length'] = len(raw_text)
    normalized['ai_parsed'] = False
    return normalized


@app.get('/api/profile/photo')
async def profile_photo(path: str = Query(..., description='Absolute path to extracted photo')) -> FileResponse:
    file_path = Path(path)
    if not _is_within_root(file_path, settings.uploads_root):
        raise HTTPException(status_code=400, detail='Path must be inside uploads root')
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='Photo not found')
    return FileResponse(path=str(file_path))


@app.post('/api/profile/import-resume')
async def import_resume(file: UploadFile = File(...)) -> dict[str, Any]:
    """Upload a PDF resume and extract structured profile data using an LLM."""
    if not file.filename:
        raise HTTPException(status_code=400, detail='Missing file name')
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail='Only PDF files are supported')

    file_path = await _save_uploaded_file(file)
    reader = PdfReader(str(file_path))
    raw_text = extract_pdf_text(reader)
    llm_runtime = await resolve_active_runtime_config(get_repo())
    llm_payload = await parse_resume_with_llm(raw_text, llm_runtime)
    payload = llm_payload if llm_payload else parse_resume_fallback(raw_text)
    normalized = normalize_profile_payload(payload, raw_text)
    normalized['summary'] = build_professional_summary(normalized)
    photo_path, photo_mime = extract_profile_photo(reader, file_path.stem)
    normalized['profile_photo_path'] = photo_path
    normalized['profile_photo_mime'] = photo_mime
    normalized['raw_text_length'] = len(raw_text)
    normalized['ai_parsed'] = llm_payload is not None
    return normalized


@app.get('/api/config')
async def get_config(key: str = Query(default='default')) -> dict[str, Any]:
    cfg = await get_repo().get_config(key)
    return cfg or {'key': key, 'value': {}}


@app.put('/api/config')
async def set_config(key: str = Query(default='default'), payload: ConfigPayload = None) -> dict[str, Any]:
    payload = payload or ConfigPayload(value={})
    updated = await get_repo().set_config(key, payload.value)
    return updated


@app.get('/api/llm/providers')
async def get_llm_providers() -> dict[str, Any]:
    return await list_provider_summaries(get_repo())


@app.post('/api/llm/providers')
async def create_llm_provider(payload: LLMProviderCreatePayload) -> dict[str, Any]:
    try:
        return await create_provider(
            get_repo(),
            name=payload.name,
            base_url=payload.base_url,
            model=payload.model,
            api_key=payload.api_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put('/api/llm/providers/{provider_id}')
async def edit_llm_provider(provider_id: str, payload: LLMProviderUpdatePayload) -> dict[str, Any]:
    try:
        return await update_provider(
            get_repo(),
            provider_id,
            name=payload.name,
            base_url=payload.base_url,
            model=payload.model,
            api_key=payload.api_key,
            clear_api_key=payload.clear_api_key,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail='Provider not found') from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post('/api/llm/providers/{provider_id}/activate')
async def set_active_llm_provider(provider_id: str) -> dict[str, Any]:
    try:
        return await activate_provider(get_repo(), provider_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail='Provider not found') from exc


@app.delete('/api/llm/providers/{provider_id}')
async def remove_llm_provider(provider_id: str) -> dict[str, Any]:
    try:
        return await delete_llm_provider(get_repo(), provider_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail='Provider not found') from exc


@app.post('/api/llm/providers/test')
async def test_llm_provider(payload: LLMProviderTestPayload) -> dict[str, Any]:
    from openai import AsyncOpenAI

    repository = get_repo()
    selected_provider: dict[str, Any] | None = None
    if payload.provider_id:
        selected_provider = await get_provider(repository, payload.provider_id)
        if selected_provider is None:
            raise HTTPException(status_code=404, detail='Provider not found')

    base_url = (payload.base_url or (selected_provider['base_url'] if selected_provider else '')).strip().rstrip('/')
    model = (payload.model or (selected_provider['model'] if selected_provider else '')).strip()
    if not base_url or not model:
        raise HTTPException(status_code=400, detail='base_url and model are required for provider test')

    api_key = (payload.api_key or '').strip()
    key_source = 'payload'
    if not api_key and selected_provider:
        api_key, key_source = await resolve_provider_api_key(repository, selected_provider)
    if not api_key:
        raise HTTPException(status_code=400, detail='No API key configured for this provider')

    try:
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        await client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': 'Return only the text: ok'}],
            temperature=0,
            max_tokens=8,
        )
        return {
            'ok': True,
            'message': 'Provider test succeeded',
            'base_url': base_url,
            'model': model,
            'key_source': key_source,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Provider test failed: {exc}') from exc


@app.post('/api/credentials')
async def store_credential(payload: CredentialPayload) -> dict[str, Any]:
    if payload.domain == LLM_PROVIDER_VAULT_DOMAIN:
        raise HTTPException(status_code=400, detail='Reserved domain for internal LLM provider secrets')
    salt, nonce, ciphertext = encrypt_secret(
        settings.vault_master_passphrase,
        {'password': payload.password},
    )
    saved = await get_repo().insert_credential(
        domain=payload.domain,
        username=payload.username,
        salt=salt,
        nonce=nonce,
        ciphertext=ciphertext,
        metadata=payload.metadata,
    )
    return saved


@app.get('/api/credentials')
async def list_credentials() -> dict[str, Any]:
    credentials = await get_repo().list_credentials()
    items = []
    for cred in credentials:
        if cred['domain'] == LLM_PROVIDER_VAULT_DOMAIN:
            continue
        items.append({
            'domain': cred['domain'],
            'username': cred['username'],
            'metadata': cred.get('metadata', {}),
            'created_at': cred.get('created_at'),
        })
    return {'items': items}


@app.get('/api/credentials/{domain}/{username}')
async def get_credential(domain: str, username: str) -> dict[str, Any]:
    if domain == LLM_PROVIDER_VAULT_DOMAIN:
        raise HTTPException(status_code=404, detail='Credential not found')
    cred = await get_repo().get_credential(domain, username)
    if not cred:
        raise HTTPException(status_code=404, detail='Credential not found')
    decrypted = decrypt_secret(
        settings.vault_master_passphrase,
        cred['salt'],
        cred['nonce'],
        cred['ciphertext'],
    )
    return {
        'domain': cred['domain'],
        'username': cred['username'],
        'metadata': cred.get('metadata', {}),
        'password': decrypted.get('password', ''),
    }


@app.delete('/api/credentials/{domain}/{username}')
async def delete_credential(domain: str, username: str) -> dict[str, Any]:
    if domain == LLM_PROVIDER_VAULT_DOMAIN:
        raise HTTPException(status_code=404, detail='Credential not found')
    await get_repo().delete_credential(domain, username)
    return {'success': True}


@app.post('/api/schedules')
async def create_schedule(payload: ScheduleCreateRequest) -> dict[str, Any]:
    now = datetime.utcnow()
    itr = croniter(payload.cron_expr, now)
    next_run = itr.get_next(datetime)
    created = await get_repo().create_schedule(
        name=payload.name,
        cron_expr=payload.cron_expr,
        timezone_name=payload.timezone,
        payload=payload.payload,
        next_run_at=next_run,
    )
    return created


@app.get('/api/schedules')
async def list_schedules() -> dict[str, Any]:
    schedules = await get_repo().list_schedules()
    return {'items': schedules}


@app.delete('/api/schedules/{id}')
async def delete_schedule(id: str) -> dict[str, Any]:
    await get_repo().delete_schedule(UUID(id))
    return {'success': True}
