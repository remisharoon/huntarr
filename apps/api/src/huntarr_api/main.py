from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from croniter import croniter
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pypdf import PdfReader
from sse_starlette.sse import EventSourceResponse

from huntarr_api.config import settings
from huntarr_api.schemas import (
    ApplicationDetailResponse,
    ConfigPayload,
    CredentialPayload,
    HealthResponse,
    JobDetailResponse,
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

    file_path = settings.uploads_root / file.filename
    content = await file.read()
    file_path.write_bytes(content)
    return {'path': str(file_path), 'size': len(content)}


@app.post('/api/profile/parse-resume')
async def parse_resume(path: str = Query(..., description='Absolute path from resume-upload response')) -> dict[str, Any]:
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail='Resume not found')

    reader = PdfReader(str(file_path))
    text_fragments: list[str] = []
    for page in reader.pages:
        text_fragments.append(page.extract_text() or '')
    text = '\n'.join(text_fragments)

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    inferred_name = lines[0] if lines else ''
    inferred_email = next((line for line in lines if '@' in line and ' ' not in line), '')

    parsed = {
        'full_name': inferred_name,
        'email': inferred_email,
        'summary': text[:1200],
        'raw_text_length': len(text),
    }
    return parsed


@app.get('/api/config')
async def get_config(key: str = Query(default='default')) -> dict[str, Any]:
    cfg = await get_repo().get_config(key)
    return cfg or {'key': key, 'value': {}}


@app.put('/api/config')
async def set_config(key: str = Query(default='default'), payload: ConfigPayload = None) -> dict[str, Any]:
    payload = payload or ConfigPayload(value={})
    updated = await get_repo().set_config(key, payload.value)
    return updated


@app.post('/api/credentials')
async def store_credential(payload: CredentialPayload) -> dict[str, Any]:
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
        items.append({
            'domain': cred['domain'],
            'username': cred['username'],
            'metadata': cred.get('metadata', {}),
            'created_at': cred.get('created_at'),
        })
    return {'items': items}


@app.get('/api/credentials/{domain}/{username}')
async def get_credential(domain: str, username: str) -> dict[str, Any]:
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
