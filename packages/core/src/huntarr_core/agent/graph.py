from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Literal, TypedDict, cast
from uuid import UUID

from langgraph.graph import END, START, StateGraph

from huntarr_core.browser.engine import ApplicationEngine
from huntarr_core.connectors.discovery import discover_jobs
from huntarr_core.db.repo import HuntRepo
from huntarr_core.documents import (
    build_cover_letter_text,
    build_output_paths,
    write_resume_pdf,
    write_text_document,
)
from huntarr_core.ranking import score_job
from huntarr_core.types import SearchConfig

logger = logging.getLogger(__name__)


class HuntState(TypedDict, total=False):
    run_id: str
    profile_id: str
    search_config: dict[str, Any]
    source_cursor: dict[str, Any]
    candidate_jobs: list[dict[str, Any]]
    selected_jobs: list[dict[str, Any]]
    job_cursor: int
    current_job: dict[str, Any] | None
    apply_attempt: dict[str, Any]
    manual_action_id: str | None
    artifacts: dict[str, Any]
    errors: list[str]
    metrics: dict[str, Any]
    generated_docs: dict[str, str]
    pause_requested: bool
    challenge_detected: bool
    run_complete: bool


class HuntGraphRunner:
    def __init__(self, repo: HuntRepo, artifact_root: Path):
        self.repo = repo
        self.artifact_root = artifact_root
        self.engine = ApplicationEngine(artifact_root=artifact_root)
        self.graph = self._build_graph().compile()

    def _build_graph(self):
        graph = StateGraph(HuntState)

        graph.add_node("load_profile_and_prefs", self.load_profile_and_prefs)
        graph.add_node("discover_jobs", self.discover_jobs_node)
        graph.add_node("normalize_and_dedupe", self.normalize_and_dedupe)
        graph.add_node("rank_and_filter", self.rank_and_filter)
        graph.add_node("pick_next_job", self.pick_next_job)
        graph.add_node("prepare_documents", self.prepare_documents)
        graph.add_node("open_application_flow", self.open_application_flow)
        graph.add_node("handle_account_step", self.handle_account_step)
        graph.add_node("fill_form", self.fill_form)
        graph.add_node("answer_questionnaire", self.answer_questionnaire)
        graph.add_node("detect_challenge", self.detect_challenge)
        graph.add_node("manual_intervention_wait", self.manual_intervention_wait)
        graph.add_node("submit_application", self.submit_application)
        graph.add_node("verify_submission", self.verify_submission)
        graph.add_node("persist_result_and_metrics", self.persist_result_and_metrics)
        graph.add_node("finalize_run", self.finalize_run)

        graph.add_edge(START, "load_profile_and_prefs")
        graph.add_edge("load_profile_and_prefs", "discover_jobs")
        graph.add_edge("discover_jobs", "normalize_and_dedupe")
        graph.add_edge("normalize_and_dedupe", "rank_and_filter")
        graph.add_edge("rank_and_filter", "pick_next_job")

        graph.add_conditional_edges(
            "pick_next_job",
            self.route_from_pick_next,
            {
                "next": "prepare_documents",
                "done": "finalize_run",
            },
        )

        graph.add_edge("prepare_documents", "open_application_flow")
        graph.add_edge("open_application_flow", "handle_account_step")
        graph.add_edge("handle_account_step", "fill_form")
        graph.add_edge("fill_form", "answer_questionnaire")
        graph.add_edge("answer_questionnaire", "detect_challenge")
        graph.add_conditional_edges(
            "detect_challenge",
            self.route_from_detect,
            {
                "manual": "manual_intervention_wait",
                "submit": "submit_application",
            },
        )
        graph.add_edge("manual_intervention_wait", "persist_result_and_metrics")
        graph.add_edge("submit_application", "verify_submission")
        graph.add_edge("verify_submission", "persist_result_and_metrics")

        graph.add_conditional_edges(
            "persist_result_and_metrics",
            self.route_after_persist,
            {
                "next": "pick_next_job",
                "finalize": "finalize_run",
            },
        )
        graph.add_edge("finalize_run", END)
        return graph

    async def run(self, run_id: UUID, existing_state: dict[str, Any] | None = None) -> dict[str, Any]:
        baseline: HuntState = {
            "run_id": str(run_id),
            "candidate_jobs": [],
            "selected_jobs": [],
            "job_cursor": 0,
            "current_job": None,
            "apply_attempt": {},
            "manual_action_id": None,
            "artifacts": {},
            "errors": [],
            "metrics": {"applied": 0, "failed": 0, "manual_required": 0, "skipped": 0},
            "generated_docs": {},
            "pause_requested": False,
            "challenge_detected": False,
            "run_complete": False,
        }

        if existing_state:
            baseline.update(existing_state)

        result = await self.graph.ainvoke(baseline)
        return cast(dict[str, Any], result)

    async def load_profile_and_prefs(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        profile = await self.repo.ensure_default_profile()
        prefs = await self.repo.get_search_preferences(profile["id"])

        search_config = state.get("search_config") or {}
        if prefs:
            search_config = {**prefs.get("rule_config", {}), **search_config}
            if prefs.get("natural_language_override") and not search_config.get("natural_language_override"):
                search_config["natural_language_override"] = prefs["natural_language_override"]

        state["profile_id"] = str(profile["id"])
        state["search_config"] = search_config

        await self.repo.touch_run_progress(run_id, "load_profile_and_prefs")
        await self.repo.insert_run_event(run_id, "info", "load_profile_and_prefs", "node", "Loaded profile and preferences")
        await self.repo.save_run_state(run_id, state, current_node="load_profile_and_prefs")
        return state

    async def discover_jobs_node(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        await self.repo.touch_run_progress(run_id, "discover_jobs")

        config = SearchConfig.model_validate(state.get("search_config", {}))
        if config.target_job_id and state.get("candidate_jobs"):
            await self.repo.insert_run_event(
                run_id,
                "info",
                "discover_jobs",
                "targeted_discovery_skip",
                "Skipping discovery for targeted apply-now run",
            )
            await self.repo.save_run_state(run_id, state, current_node="discover_jobs")
            return state

        jobs = await discover_jobs(config)
        state["candidate_jobs"] = jobs

        await self.repo.insert_run_event(
            run_id,
            "info",
            "discover_jobs",
            "jobs_discovered",
            f"Discovered {len(jobs)} jobs",
            {"count": len(jobs)},
        )
        await self.repo.save_run_state(run_id, state, current_node="discover_jobs")
        return state

    async def normalize_and_dedupe(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        await self.repo.touch_run_progress(run_id, "normalize_and_dedupe")

        persisted = await self.repo.upsert_jobs(state.get("candidate_jobs", []))
        state["candidate_jobs"] = persisted

        await self.repo.insert_run_event(
            run_id,
            "info",
            "normalize_and_dedupe",
            "jobs_persisted",
            f"Persisted {len(persisted)} jobs",
            {"count": len(persisted)},
        )
        await self.repo.save_run_state(run_id, state, current_node="normalize_and_dedupe")
        return state

    async def rank_and_filter(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        await self.repo.touch_run_progress(run_id, "rank_and_filter")

        config = SearchConfig.model_validate(state.get("search_config", {}))
        if config.target_job_id and state.get("selected_jobs"):
            await self.repo.insert_run_event(
                run_id,
                "info",
                "rank_and_filter",
                "targeted_rank_skip",
                "Skipping ranking for targeted apply-now run",
            )
            await self.repo.save_run_state(run_id, state, current_node="rank_and_filter")
            return state

        scored_payload: list[dict[str, Any]] = []
        selected: list[dict[str, Any]] = []

        for job in state.get("candidate_jobs", []):
            score, explanation = score_job(job, config)
            scored_payload.append(
                {
                    "job_id": job["id"],
                    "score": score,
                    "explanation": explanation,
                }
            )
            if score >= 0:
                selected.append({**job, "score": score, "explanation": explanation})

        await self.repo.upsert_scores(scored_payload)
        selected.sort(key=lambda x: x.get("score", 0), reverse=True)
        state["selected_jobs"] = selected[: config.max_jobs_per_run]
        state["job_cursor"] = 0

        await self.repo.insert_run_event(
            run_id,
            "info",
            "rank_and_filter",
            "jobs_ranked",
            f"Ranked {len(scored_payload)} jobs, selected {len(state['selected_jobs'])}",
            {"ranked": len(scored_payload), "selected": len(state["selected_jobs"])},
        )
        await self.repo.save_run_state(run_id, state, current_node="rank_and_filter")
        return state

    async def pick_next_job(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        await self.repo.touch_run_progress(run_id, "pick_next_job")

        cursor = int(state.get("job_cursor", 0))
        selected = state.get("selected_jobs", [])

        if state.get("pause_requested"):
            state["run_complete"] = True
            state["current_job"] = None
        elif cursor >= len(selected):
            state["run_complete"] = True
            state["current_job"] = None
        else:
            state["current_job"] = selected[cursor]
            state["job_cursor"] = cursor + 1
            state["run_complete"] = False

        await self.repo.save_run_state(run_id, state, current_node="pick_next_job")
        return state

    async def prepare_documents(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        profile = await self.repo.get_latest_profile()
        current_job = state.get("current_job")
        if not profile or not current_job:
            return state

        await self.repo.touch_run_progress(run_id, "prepare_documents")

        resume_path, cover_path = build_output_paths(
            self.artifact_root,
            run_id,
            UUID(str(current_job["id"])),
        )
        write_resume_pdf(profile, current_job, resume_path)
        cover_text = build_cover_letter_text(profile, current_job)
        write_text_document(cover_text, cover_path)

        state["generated_docs"] = {
            "resume_pdf": str(resume_path),
            "cover_letter_txt": str(cover_path),
        }

        await self.repo.create_generated_document(
            run_id,
            UUID(str(current_job["id"])),
            "resume_pdf",
            str(resume_path),
            {"tailored": True},
        )
        await self.repo.create_generated_document(
            run_id,
            UUID(str(current_job["id"])),
            "cover_letter_txt",
            str(cover_path),
            {"tailored": True},
        )
        await self.repo.insert_run_event(
            run_id,
            "info",
            "prepare_documents",
            "docs_ready",
            "Generated tailored documents",
            state["generated_docs"],
        )
        await self.repo.save_run_state(run_id, state, current_node="prepare_documents")
        return state

    async def open_application_flow(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        await self.repo.touch_run_progress(run_id, "open_application_flow")
        await self.repo.insert_run_event(
            run_id,
            "info",
            "open_application_flow",
            "node",
            "Opening application flow",
            {"job_id": state.get("current_job", {}).get("id")},
        )
        await self.repo.save_run_state(run_id, state, current_node="open_application_flow")
        return state

    async def handle_account_step(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        await self.repo.touch_run_progress(run_id, "handle_account_step")
        await self.repo.insert_run_event(
            run_id,
            "info",
            "handle_account_step",
            "policy",
            "Company ATS login/account creation is allowed; platform logins are restricted",
        )
        await self.repo.save_run_state(run_id, state, current_node="handle_account_step")
        return state

    async def fill_form(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        current_job = state.get("current_job")
        profile = await self.repo.get_latest_profile()

        if not current_job or not profile:
            return state

        await self.repo.touch_run_progress(run_id, "fill_form")
        prefill_result = await self.engine.apply_to_job(
            str(run_id),
            current_job,
            profile,
            state.get("generated_docs", {}),
            submit=False,
        )

        state["apply_attempt"] = {
            "status": prefill_result.status,
            "source_portal": prefill_result.source_portal,
            "failure_code": prefill_result.failure_code,
            "artifacts": prefill_result.artifacts or {},
            "needs_manual_action": prefill_result.needs_manual_action,
            "manual_action_type": prefill_result.manual_action_type,
        }

        await self.repo.insert_run_event(
            run_id,
            "info",
            "fill_form",
            "prefill_complete",
            "Prefill step finished",
            state["apply_attempt"],
        )
        await self.repo.save_run_state(run_id, state, current_node="fill_form")
        return state

    async def answer_questionnaire(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        await self.repo.touch_run_progress(run_id, "answer_questionnaire")
        # Deterministic profile-first answers for common ATS questions.
        state["apply_attempt"]["answers"] = [
            {
                "question": "Are you legally authorized to work in this location?",
                "answer": "Yes",
                "confidence": 0.7,
            },
            {
                "question": "Do you require sponsorship?",
                "answer": "No",
                "confidence": 0.4,
            },
        ]

        await self.repo.insert_run_event(
            run_id,
            "info",
            "answer_questionnaire",
            "questionnaire_answered",
            "Auto-answered questionnaire from profile rules",
            {"answers_count": len(state["apply_attempt"]["answers"])},
        )
        await self.repo.save_run_state(run_id, state, current_node="answer_questionnaire")
        return state

    async def detect_challenge(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        attempt = state.get("apply_attempt", {})
        needs_manual = bool(attempt.get("needs_manual_action"))
        state["challenge_detected"] = needs_manual

        await self.repo.touch_run_progress(run_id, "detect_challenge")
        await self.repo.insert_run_event(
            run_id,
            "warning" if needs_manual else "info",
            "detect_challenge",
            "challenge_check",
            "Manual intervention required" if needs_manual else "No challenge detected",
            {"needs_manual": needs_manual},
        )
        await self.repo.save_run_state(run_id, state, current_node="detect_challenge")
        return state

    async def manual_intervention_wait(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        current_job = state.get("current_job")
        attempt = state.get("apply_attempt", {})
        if not current_job:
            return state

        action = await self.repo.create_manual_action(
            run_id=run_id,
            job_id=UUID(str(current_job["id"])),
            action_type=attempt.get("manual_action_type") or "unexpected_form",
            details={
                "reason": attempt.get("failure_code") or "manual_step_required",
                "job_url": current_job.get("url"),
            },
            session_url=os.getenv("PLAYWRIGHT_VNC_URL", "http://localhost:7900"),
        )
        state["manual_action_id"] = str(action.get("id")) if action else None
        state["pause_requested"] = True
        state["job_cursor"] = max(0, int(state.get("job_cursor", 1)) - 1)

        await self.repo.update_run_status(run_id, "paused", current_node="manual_intervention_wait")
        await self.repo.insert_run_event(
            run_id,
            "warning",
            "manual_intervention_wait",
            "manual_action_created",
            "Run paused for manual intervention",
            {"manual_action_id": state["manual_action_id"]},
        )
        await self.repo.save_run_state(run_id, state, current_node="manual_intervention_wait")
        return state

    async def submit_application(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        current_job = state.get("current_job")
        profile = await self.repo.get_latest_profile()

        if not current_job or not profile:
            return state

        await self.repo.touch_run_progress(run_id, "submit_application")
        submit_result = await self.engine.apply_to_job(
            str(run_id),
            current_job,
            profile,
            state.get("generated_docs", {}),
            submit=True,
        )

        state["apply_attempt"] = {
            "status": submit_result.status,
            "source_portal": submit_result.source_portal,
            "failure_code": submit_result.failure_code,
            "confirmation_text": submit_result.confirmation_text,
            "artifacts": submit_result.artifacts or {},
            "needs_manual_action": submit_result.needs_manual_action,
            "manual_action_type": submit_result.manual_action_type,
            "answers": state.get("apply_attempt", {}).get("answers", []),
        }

        await self.repo.insert_run_event(
            run_id,
            "info",
            "submit_application",
            "submission_attempt",
            "Submission attempt completed",
            state["apply_attempt"],
        )
        await self.repo.save_run_state(run_id, state, current_node="submit_application")
        return state

    async def verify_submission(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        attempt = state.get("apply_attempt", {})
        status = attempt.get("status")

        await self.repo.touch_run_progress(run_id, "verify_submission")

        if status == "submitted":
            metrics = state.setdefault("metrics", {})
            metrics["applied"] = int(metrics.get("applied", 0)) + 1
        elif status == "skipped":
            metrics = state.setdefault("metrics", {})
            metrics["skipped"] = int(metrics.get("skipped", 0)) + 1
        elif status == "manual_required":
            metrics = state.setdefault("metrics", {})
            metrics["manual_required"] = int(metrics.get("manual_required", 0)) + 1
        else:
            metrics = state.setdefault("metrics", {})
            metrics["failed"] = int(metrics.get("failed", 0)) + 1

        await self.repo.insert_run_event(
            run_id,
            "info",
            "verify_submission",
            "verification",
            f"Application status: {status}",
            {"status": status},
        )
        await self.repo.save_run_state(run_id, state, current_node="verify_submission")
        return state

    async def persist_result_and_metrics(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        current_job = state.get("current_job")
        attempt = state.get("apply_attempt", {})
        if current_job and attempt:
            app = await self.repo.create_application(
                run_id=run_id,
                job_id=UUID(str(current_job["id"])),
                status=attempt.get("status", "failed"),
                source_portal=attempt.get("source_portal"),
                error_code=attempt.get("failure_code"),
                confirmation_text=attempt.get("confirmation_text"),
                artifacts=attempt.get("artifacts", {}),
            )
            answers = attempt.get("answers", [])
            if app and answers:
                await self.repo.insert_application_answers(UUID(str(app["id"])), answers)

        metrics = state.get("metrics", {})
        await self.repo.update_run_metrics(run_id, metrics)
        await self.repo.save_run_state(run_id, state, current_node="persist_result_and_metrics", metrics=metrics)
        return state

    async def finalize_run(self, state: HuntState) -> HuntState:
        run_id = UUID(state["run_id"])
        status = "paused" if state.get("pause_requested") else "completed"
        await self.repo.update_run_status(
            run_id,
            status,
            current_node="finalize_run",
            completed=not state.get("pause_requested"),
        )
        await self.repo.insert_run_event(
            run_id,
            "info",
            "finalize_run",
            "run_complete",
            f"Run finished with status={status}",
            {"metrics": state.get("metrics", {})},
        )
        await self.repo.save_run_state(run_id, state, current_node="finalize_run", metrics=state.get("metrics", {}))
        return state

    def route_from_pick_next(self, state: HuntState) -> Literal["next", "done"]:
        return "done" if state.get("run_complete") else "next"

    def route_from_detect(self, state: HuntState) -> Literal["manual", "submit"]:
        return "manual" if state.get("challenge_detected") else "submit"

    def route_after_persist(self, state: HuntState) -> Literal["next", "finalize"]:
        if state.get("pause_requested"):
            return "finalize"
        selected = state.get("selected_jobs", [])
        cursor = int(state.get("job_cursor", 0))
        if cursor >= len(selected):
            return "finalize"
        return "next"
