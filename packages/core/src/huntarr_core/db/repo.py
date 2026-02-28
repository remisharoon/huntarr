from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import asyncpg

from huntarr_core.constants import DEFAULT_QUEUE_NAME

_JSON_COLUMNS = {
    "artifacts",
    "details",
    "education",
    "explanation",
    "meta",
    "metadata",
    "metrics",
    "payload",
    "payload_json",
    "preferences",
    "raw_json",
    "rule_config",
    "search_config",
    "skills",
    "state_json",
    "value",
    "experience",
}


def _json_default(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.hex()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _json_dumps(value: Any) -> str:
    return json.dumps(value, default=_json_default)


def _normalize_json_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return value
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return value
    return value


def _normalize_row(row: asyncpg.Record | dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    for key in _JSON_COLUMNS:
        if key in normalized:
            normalized[key] = _normalize_json_value(normalized[key])
    return normalized


class HuntRepo:
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def create_run(self, mode: str, search_config: dict[str, Any]) -> dict[str, Any]:
        query = """
        INSERT INTO run_sessions(mode, status, search_config, started_at)
        VALUES ($1, 'queued', $2::jsonb, NOW())
        RETURNING *
        """
        row = await self.pool.fetchrow(query, mode, _json_dumps(search_config))
        return _normalize_row(row) if row else {}

    async def fetch_run(self, run_id: UUID) -> dict[str, Any] | None:
        row = await self.pool.fetchrow("SELECT * FROM run_sessions WHERE id = $1", run_id)
        return _normalize_row(row) if row else None

    async def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            "SELECT * FROM run_sessions ORDER BY updated_at DESC LIMIT $1", limit
        )
        return [_normalize_row(row) for row in rows]

    async def update_run_status(
        self,
        run_id: UUID,
        status: str,
        current_node: str | None = None,
        error: str | None = None,
        completed: bool = False,
    ) -> None:
        await self.pool.execute(
            """
            UPDATE run_sessions
               SET status = $2,
                   current_node = COALESCE($3, current_node),
                   error = COALESCE($4, error),
                   completed_at = CASE WHEN $5 THEN NOW() ELSE completed_at END,
                   updated_at = NOW()
             WHERE id = $1
            """,
            run_id,
            status,
            current_node,
            error,
            completed,
        )

    async def save_run_state(
        self,
        run_id: UUID,
        state_json: dict[str, Any],
        current_node: str | None = None,
        metrics: dict[str, Any] | None = None,
    ) -> None:
        await self.pool.execute(
            """
            UPDATE run_sessions
               SET state_json = $2::jsonb,
                   current_node = COALESCE($3, current_node),
                   metrics = COALESCE($4::jsonb, metrics),
                   updated_at = NOW()
             WHERE id = $1
            """,
            run_id,
            _json_dumps(state_json),
            current_node,
            _json_dumps(metrics) if metrics is not None else None,
        )

    async def insert_run_event(
        self,
        run_id: UUID,
        level: str,
        node: str | None,
        event_type: str,
        message: str,
        payload_json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO run_events(run_id, level, node, event_type, message, payload_json)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb))
            RETURNING *
            """,
            run_id,
            level,
            node,
            event_type,
            message,
            _json_dumps(payload_json or {}),
        )
        return _normalize_row(row) if row else {}

    async def fetch_run_events(
        self,
        run_id: UUID,
        after_id: int = 0,
        limit: int = 250,
    ) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            """
            SELECT *
              FROM run_events
             WHERE run_id = $1
               AND id > $2
             ORDER BY id ASC
             LIMIT $3
            """,
            run_id,
            after_id,
            limit,
        )
        return [_normalize_row(row) for row in rows]

    async def enqueue_job(
        self,
        payload: dict[str, Any],
        run_id: UUID | None,
        queue_name: str = DEFAULT_QUEUE_NAME,
        max_attempts: int = 5,
        delay_seconds: int = 0,
    ) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO job_queue(queue_name, run_id, payload, max_attempts, available_at)
            VALUES (
                $1,
                $2,
                $3::jsonb,
                $4,
                NOW() + make_interval(secs => $5)
            )
            RETURNING *
            """,
            queue_name,
            run_id,
            _json_dumps(payload),
            max_attempts,
            delay_seconds,
        )
        return _normalize_row(row) if row else {}

    async def claim_next_job(
        self,
        worker_id: str,
        queue_name: str = DEFAULT_QUEUE_NAME,
    ) -> dict[str, Any] | None:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    """
                    WITH candidate AS (
                        SELECT id
                          FROM job_queue
                         WHERE queue_name = $1
                           AND status = 'pending'
                           AND available_at <= NOW()
                         ORDER BY available_at ASC, id ASC
                         FOR UPDATE SKIP LOCKED
                         LIMIT 1
                    )
                    UPDATE job_queue q
                       SET status = 'in_progress',
                           locked_by = $2,
                           locked_at = NOW(),
                           updated_at = NOW()
                      FROM candidate c
                     WHERE q.id = c.id
                    RETURNING q.*
                    """,
                    queue_name,
                    worker_id,
                )
                return _normalize_row(row) if row else None

    async def complete_job(self, job_id: int) -> None:
        await self.pool.execute(
            """
            UPDATE job_queue
               SET status = 'completed',
                   updated_at = NOW()
             WHERE id = $1
            """,
            job_id,
        )

    async def fail_job(
        self,
        job_id: int,
        error: str,
        permanent: bool = False,
        retry_base_seconds: int = 30,
    ) -> None:
        row = await self.pool.fetchrow(
            "SELECT attempts, max_attempts FROM job_queue WHERE id = $1",
            job_id,
        )
        if not row:
            return
        attempts = int(row["attempts"]) + 1
        max_attempts = int(row["max_attempts"])
        should_dead_letter = permanent or attempts >= max_attempts

        if should_dead_letter:
            await self.pool.execute(
                """
                UPDATE job_queue
                   SET attempts = $2,
                       status = 'failed_permanent',
                       last_error = $3,
                       updated_at = NOW()
                 WHERE id = $1
                """,
                job_id,
                attempts,
                error,
            )
            return

        backoff = int(retry_base_seconds * math.pow(2, attempts - 1))
        await self.pool.execute(
            """
            UPDATE job_queue
               SET attempts = $2,
                   status = 'pending',
                   last_error = $3,
                   available_at = NOW() + make_interval(secs => $4),
                   locked_by = NULL,
                   locked_at = NULL,
                   updated_at = NOW()
             WHERE id = $1
            """,
            job_id,
            attempts,
            error,
            backoff,
        )

    async def upsert_profile(self, payload: dict[str, Any]) -> dict[str, Any]:
        profile_id = payload.get("id")
        if profile_id:
            row = await self.pool.fetchrow(
                """
                UPDATE profiles
                   SET full_name = $2,
                       email = $3,
                       phone = $4,
                       location = $5,
                       years_experience = $6,
                       summary = $7,
                       skills = $8::jsonb,
                       experience = $9::jsonb,
                       education = $10::jsonb,
                       preferences = $11::jsonb,
                       updated_at = NOW()
                 WHERE id = $1
             RETURNING *
                """,
                UUID(str(profile_id)),
                payload.get("full_name", ""),
                payload.get("email", ""),
                payload.get("phone"),
                payload.get("location"),
                payload.get("years_experience", 0),
                payload.get("summary", ""),
                _json_dumps(payload.get("skills", [])),
                _json_dumps(payload.get("experience", [])),
                _json_dumps(payload.get("education", [])),
                _json_dumps(payload.get("preferences", {})),
            )
            if row:
                return _normalize_row(row)

        row = await self.pool.fetchrow(
            """
            INSERT INTO profiles(
                full_name,
                email,
                phone,
                location,
                years_experience,
                summary,
                skills,
                experience,
                education,
                preferences
            ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb)
            RETURNING *
            """,
            payload.get("full_name", ""),
            payload.get("email", ""),
            payload.get("phone"),
            payload.get("location"),
            payload.get("years_experience", 0),
            payload.get("summary", ""),
            _json_dumps(payload.get("skills", [])),
            _json_dumps(payload.get("experience", [])),
            _json_dumps(payload.get("education", [])),
            _json_dumps(payload.get("preferences", {})),
        )
        return _normalize_row(row) if row else {}

    async def get_latest_profile(self) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            "SELECT * FROM profiles ORDER BY updated_at DESC LIMIT 1"
        )
        return _normalize_row(row) if row else None

    async def upsert_search_preferences(
        self,
        profile_id: UUID,
        rule_config: dict[str, Any],
        natural_language_override: str | None,
    ) -> None:
        await self.pool.execute(
            """
            INSERT INTO search_preferences(profile_id, rule_config, natural_language_override)
            VALUES ($1, $2::jsonb, $3)
            ON CONFLICT(profile_id)
            DO UPDATE SET
                rule_config = EXCLUDED.rule_config,
                natural_language_override = EXCLUDED.natural_language_override,
                updated_at = NOW()
            """,
            profile_id,
            _json_dumps(rule_config),
            natural_language_override,
        )

    async def get_search_preferences(self, profile_id: UUID) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            "SELECT * FROM search_preferences WHERE profile_id = $1",
            profile_id,
        )
        return _normalize_row(row) if row else None

    async def insert_credential(
        self,
        domain: str,
        username: str,
        salt: bytes,
        nonce: bytes,
        ciphertext: bytes,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO credentials_vault(domain, username, salt, nonce, ciphertext, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT(domain, username)
            DO UPDATE SET
                salt = EXCLUDED.salt,
                nonce = EXCLUDED.nonce,
                ciphertext = EXCLUDED.ciphertext,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            RETURNING id, domain, username, metadata, updated_at
            """,
            domain,
            username,
            salt,
            nonce,
            ciphertext,
            _json_dumps(metadata or {}),
        )
        return _normalize_row(row) if row else {}

    async def get_credential(
        self,
        domain: str,
        username: str,
    ) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            "SELECT * FROM credentials_vault WHERE domain = $1 AND username = $2",
            domain,
            username,
        )
        return _normalize_row(row) if row else None

    async def upsert_jobs(self, jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not jobs:
            return []
        persisted: list[dict[str, Any]] = []
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for job in jobs:
                    row = await conn.fetchrow(
                        """
                        INSERT INTO job_postings(
                            source,
                            source_job_id,
                            title,
                            company,
                            location,
                            url,
                            description,
                            posted_at,
                            dedupe_hash,
                            raw_json,
                            updated_at
                        )
                        VALUES (
                            $1,
                            $2,
                            $3,
                            $4,
                            $5,
                            $6,
                            $7,
                            $8,
                            $9,
                            $10::jsonb,
                            NOW()
                        )
                        ON CONFLICT(source, source_job_id)
                        DO UPDATE SET
                            title = EXCLUDED.title,
                            company = EXCLUDED.company,
                            location = EXCLUDED.location,
                            url = EXCLUDED.url,
                            description = EXCLUDED.description,
                            posted_at = EXCLUDED.posted_at,
                            dedupe_hash = EXCLUDED.dedupe_hash,
                            raw_json = EXCLUDED.raw_json,
                            updated_at = NOW()
                        RETURNING *
                        """,
                        job["source"],
                        job["source_job_id"],
                        job["title"],
                        job["company"],
                        job.get("location"),
                        job["url"],
                        job.get("description", ""),
                        job.get("posted_at"),
                        job["dedupe_hash"],
                        _json_dumps(job.get("source_meta", {})),
                    )
                    if not row:
                        continue
                    persisted_row = _normalize_row(row)
                    persisted.append(persisted_row)
                    await conn.execute(
                        """
                        INSERT INTO job_dedupe_map(dedupe_hash, canonical_job_id)
                        VALUES ($1, $2)
                        ON CONFLICT(dedupe_hash)
                        DO UPDATE SET
                            canonical_job_id = EXCLUDED.canonical_job_id,
                            updated_at = NOW()
                        """,
                        persisted_row["dedupe_hash"],
                        persisted_row["id"],
                    )
        return persisted

    async def list_jobs(self, limit: int = 200) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            """
            SELECT j.*, s.score, s.explanation
              FROM job_postings j
              LEFT JOIN job_scores s ON s.job_id = j.id
             ORDER BY COALESCE(s.score, 0) DESC, j.updated_at DESC
             LIMIT $1
            """,
            limit,
        )
        return [_normalize_row(row) for row in rows]

    async def get_job(self, job_id: UUID) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            """
            SELECT j.*, s.score, s.explanation
              FROM job_postings j
              LEFT JOIN job_scores s ON s.job_id = j.id
             WHERE j.id = $1
            """,
            job_id,
        )
        return _normalize_row(row) if row else None

    async def upsert_scores(self, scores: list[dict[str, Any]]) -> None:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for score in scores:
                    await conn.execute(
                        """
                        INSERT INTO job_scores(job_id, score, explanation)
                        VALUES ($1, $2, $3::jsonb)
                        ON CONFLICT(job_id)
                        DO UPDATE SET
                            score = EXCLUDED.score,
                            explanation = EXCLUDED.explanation,
                            updated_at = NOW()
                        """,
                        score["job_id"],
                        score["score"],
                        _json_dumps(score.get("explanation", {})),
                    )

    async def create_application(
        self,
        run_id: UUID,
        job_id: UUID,
        status: str,
        source_portal: str | None = None,
        error_code: str | None = None,
        confirmation_text: str | None = None,
        artifacts: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO applications(
                run_id,
                job_id,
                status,
                source_portal,
                error_code,
                confirmation_text,
                artifacts,
                submitted_at,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7::jsonb,
                CASE WHEN $3 = 'submitted' THEN NOW() ELSE NULL END,
                NOW()
            )
            RETURNING *
            """,
            run_id,
            job_id,
            status,
            source_portal,
            error_code,
            confirmation_text,
            _json_dumps(artifacts or {}),
        )
        return _normalize_row(row) if row else {}

    async def update_application(
        self,
        application_id: UUID,
        status: str,
        error_code: str | None = None,
        confirmation_text: str | None = None,
        artifacts: dict[str, Any] | None = None,
    ) -> None:
        await self.pool.execute(
            """
            UPDATE applications
               SET status = $2,
                   error_code = $3,
                   confirmation_text = COALESCE($4, confirmation_text),
                   artifacts = COALESCE($5::jsonb, artifacts),
                   submitted_at = CASE WHEN $2 = 'submitted' THEN NOW() ELSE submitted_at END,
                   updated_at = NOW()
             WHERE id = $1
            """,
            application_id,
            status,
            error_code,
            confirmation_text,
            _json_dumps(artifacts) if artifacts is not None else None,
        )

    async def list_applications(self, limit: int = 200) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            """
            SELECT a.*, j.title, j.company, j.url
              FROM applications a
              JOIN job_postings j ON j.id = a.job_id
             ORDER BY a.updated_at DESC
             LIMIT $1
            """,
            limit,
        )
        return [_normalize_row(row) for row in rows]

    async def insert_application_answers(
        self,
        application_id: UUID,
        answers: list[dict[str, Any]],
    ) -> None:
        if not answers:
            return
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for answer in answers:
                    await conn.execute(
                        """
                        INSERT INTO application_answers(application_id, question, answer, confidence)
                        VALUES ($1, $2, $3, $4)
                        """,
                        application_id,
                        answer.get("question", ""),
                        answer.get("answer", ""),
                        answer.get("confidence"),
                    )

    async def create_manual_action(
        self,
        run_id: UUID,
        job_id: UUID,
        action_type: str,
        details: dict[str, Any],
        application_id: UUID | None = None,
        session_url: str | None = None,
    ) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO manual_actions(run_id, application_id, job_id, action_type, status, details, session_url)
            VALUES ($1, $2, $3, $4, 'pending', $5::jsonb, $6)
            RETURNING *
            """,
            run_id,
            application_id,
            job_id,
            action_type,
            _json_dumps(details),
            session_url,
        )
        return _normalize_row(row) if row else {}

    async def list_manual_actions(self, status: str | None = None) -> list[dict[str, Any]]:
        if status:
            rows = await self.pool.fetch(
                """
                SELECT ma.*, j.title, j.company, j.url
                  FROM manual_actions ma
                  JOIN job_postings j ON j.id = ma.job_id
                 WHERE ma.status = $1
                 ORDER BY ma.created_at DESC
                """,
                status,
            )
        else:
            rows = await self.pool.fetch(
                """
                SELECT ma.*, j.title, j.company, j.url
                  FROM manual_actions ma
                  JOIN job_postings j ON j.id = ma.job_id
                 ORDER BY ma.created_at DESC
                """
            )
        return [_normalize_row(row) for row in rows]

    async def resolve_manual_action(
        self,
        action_id: UUID,
        status: str,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            """
            UPDATE manual_actions
               SET status = $2,
                   details = COALESCE($3::jsonb, details),
                   resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
                   updated_at = NOW()
             WHERE id = $1
         RETURNING *
            """,
            action_id,
            status,
            _json_dumps(details) if details is not None else None,
        )
        return _normalize_row(row) if row else None

    async def create_generated_document(
        self,
        run_id: UUID,
        job_id: UUID,
        doc_type: str,
        path: str,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO generated_documents(run_id, job_id, doc_type, path, meta)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            RETURNING *
            """,
            run_id,
            job_id,
            doc_type,
            path,
            _json_dumps(meta or {}),
        )
        return _normalize_row(row) if row else {}

    async def list_generated_documents(self, run_id: UUID) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            "SELECT * FROM generated_documents WHERE run_id = $1 ORDER BY created_at DESC",
            run_id,
        )
        return [_normalize_row(row) for row in rows]

    async def create_schedule(
        self,
        name: str,
        cron_expr: str,
        timezone_name: str,
        payload: dict[str, Any],
        next_run_at: datetime | None,
    ) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO schedules(name, enabled, cron_expr, timezone, payload, next_run_at)
            VALUES ($1, TRUE, $2, $3, $4::jsonb, $5)
            RETURNING *
            """,
            name,
            cron_expr,
            timezone_name,
            _json_dumps(payload),
            next_run_at,
        )
        return _normalize_row(row) if row else {}

    async def list_schedules(self) -> list[dict[str, Any]]:
        rows = await self.pool.fetch("SELECT * FROM schedules ORDER BY created_at DESC")
        return [_normalize_row(row) for row in rows]

    async def list_due_schedules(self) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            """
            SELECT *
              FROM schedules
             WHERE enabled = TRUE
               AND next_run_at IS NOT NULL
               AND next_run_at <= NOW()
             ORDER BY next_run_at ASC
            """
        )
        return [_normalize_row(row) for row in rows]

    async def update_schedule_execution(
        self,
        schedule_id: UUID,
        last_run_at: datetime,
        next_run_at: datetime | None,
    ) -> None:
        await self.pool.execute(
            """
            UPDATE schedules
               SET last_run_at = $2,
                   next_run_at = $3,
                   updated_at = NOW()
             WHERE id = $1
            """,
            schedule_id,
            last_run_at,
            next_run_at,
        )

    async def set_config(self, key: str, value: dict[str, Any]) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            """
            INSERT INTO configs(key, value)
            VALUES ($1, $2::jsonb)
            ON CONFLICT(key)
            DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW()
            RETURNING *
            """,
            key,
            _json_dumps(value),
        )
        return _normalize_row(row) if row else {}

    async def get_config(self, key: str) -> dict[str, Any] | None:
        row = await self.pool.fetchrow("SELECT * FROM configs WHERE key = $1", key)
        return _normalize_row(row) if row else None

    async def ensure_default_profile(self) -> dict[str, Any]:
        existing = await self.get_latest_profile()
        if existing:
            return existing
        return await self.upsert_profile(
            {
                "full_name": "",
                "email": "",
                "phone": "",
                "location": "",
                "years_experience": 0,
                "summary": "",
                "skills": [],
                "experience": [],
                "education": [],
                "preferences": {
                    "locations": ["GCC", "Remote"],
                    "keywords": [],
                    "exclude_keywords": [],
                },
            }
        )

    async def touch_run_progress(self, run_id: UUID, current_node: str | None) -> None:
        await self.pool.execute(
            """
            UPDATE run_sessions
               SET current_node = $2,
                   updated_at = NOW(),
                   status = CASE WHEN status = 'queued' THEN 'running' ELSE status END
             WHERE id = $1
            """,
            run_id,
            current_node,
        )

    async def get_active_manual_action_for_run(self, run_id: UUID) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            """
            SELECT *
              FROM manual_actions
             WHERE run_id = $1
               AND status IN ('pending','in_progress')
             ORDER BY created_at DESC
             LIMIT 1
            """,
            run_id,
        )
        return _normalize_row(row) if row else None

    async def close_stale_in_progress_jobs(self, worker_id: str, stale_after_minutes: int = 30) -> int:
        status = await self.pool.execute(
            """
            UPDATE job_queue
               SET status = 'pending',
                   locked_by = NULL,
                   locked_at = NULL,
                   updated_at = NOW()
             WHERE status = 'in_progress'
               AND locked_by = $1
               AND locked_at < NOW() - make_interval(mins => $2)
            """,
            worker_id,
            stale_after_minutes,
        )
        # Format: UPDATE <count>
        try:
            return int(status.split(" ")[-1])
        except (ValueError, IndexError):
            return 0

    async def clear_run_error(self, run_id: UUID) -> None:
        await self.pool.execute(
            "UPDATE run_sessions SET error = NULL, updated_at = NOW() WHERE id = $1",
            run_id,
        )

    async def get_job_by_hash(self, dedupe_hash: str) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            "SELECT * FROM job_postings WHERE dedupe_hash = $1 LIMIT 1",
            dedupe_hash,
        )
        return _normalize_row(row) if row else None

    async def list_recent_events(self, limit: int = 100) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            "SELECT * FROM run_events ORDER BY id DESC LIMIT $1",
            limit,
        )
        return [_normalize_row(row) for row in rows]

    async def update_manual_action_session(
        self,
        action_id: UUID,
        status: str,
        session_url: str,
    ) -> dict[str, Any] | None:
        row = await self.pool.fetchrow(
            """
            UPDATE manual_actions
               SET status = $2,
                   session_url = $3,
                   updated_at = NOW()
             WHERE id = $1
             RETURNING *
            """,
            action_id,
            status,
            session_url,
        )
        return _normalize_row(row) if row else None

    async def pick_top_jobs_for_run(self, limit: int) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            """
            SELECT j.*, COALESCE(s.score, 0) AS score, s.explanation
              FROM job_postings j
              LEFT JOIN job_scores s ON s.job_id = j.id
             ORDER BY COALESCE(s.score, 0) DESC, j.updated_at DESC
             LIMIT $1
            """,
            limit,
        )
        return [_normalize_row(r) for r in rows]

    async def get_run_state(self, run_id: UUID) -> dict[str, Any]:
        row = await self.pool.fetchrow(
            "SELECT state_json FROM run_sessions WHERE id = $1",
            run_id,
        )
        if not row or not row["state_json"]:
            return {}
        state_json = _normalize_json_value(row["state_json"])
        return state_json if isinstance(state_json, dict) else {}

    async def update_run_metrics(self, run_id: UUID, metrics: dict[str, Any]) -> None:
        await self.pool.execute(
            """
            UPDATE run_sessions
               SET metrics = $2::jsonb,
                   updated_at = NOW()
             WHERE id = $1
            """,
            run_id,
            _json_dumps(metrics),
        )

    async def get_runs_due_for_resume(self) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            """
            SELECT rs.*
              FROM run_sessions rs
             WHERE rs.status = 'paused'
               AND EXISTS (
                   SELECT 1
                     FROM manual_actions ma
                    WHERE ma.run_id = rs.id
                      AND ma.status = 'resolved'
               )
            """
        )
        return [_normalize_row(row) for row in rows]

    async def set_run_search_config(self, run_id: UUID, search_config: dict[str, Any]) -> None:
        await self.pool.execute(
            "UPDATE run_sessions SET search_config = $2::jsonb, updated_at = NOW() WHERE id = $1",
            run_id,
            _json_dumps(search_config),
        )

    async def list_pending_queue(self, queue_name: str = DEFAULT_QUEUE_NAME) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            "SELECT * FROM job_queue WHERE queue_name = $1 AND status = 'pending' ORDER BY available_at ASC",
            queue_name,
        )
        return [_normalize_row(row) for row in rows]

    async def prune_old_events(self, older_than_days: int = 30) -> int:
        status = await self.pool.execute(
            "DELETE FROM run_events WHERE ts < NOW() - make_interval(days => $1)",
            older_than_days,
        )
        try:
            return int(status.split(" ")[-1])
        except (ValueError, IndexError):
            return 0

    async def list_open_manual_actions(self) -> list[dict[str, Any]]:
        rows = await self.pool.fetch(
            "SELECT * FROM manual_actions WHERE status IN ('pending', 'in_progress') ORDER BY created_at ASC"
        )
        return [_normalize_row(row) for row in rows]

    async def heartbeat(self) -> dict[str, Any]:
        row = await self.pool.fetchrow("SELECT NOW() as now")
        return _normalize_row(row) if row else {"now": datetime.now(timezone.utc)}
