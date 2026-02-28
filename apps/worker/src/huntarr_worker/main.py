from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from croniter import croniter

from huntarr_core.agent.graph import HuntGraphRunner
from huntarr_core.db.pool import create_db_pool, init_db_schema
from huntarr_core.db.repo import HuntRepo
from huntarr_worker.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
logger = logging.getLogger('huntarr-worker')


class Worker:
    def __init__(self, repo: HuntRepo, graph_runner: HuntGraphRunner):
        self.repo = repo
        self.graph_runner = graph_runner

    async def run_forever(self) -> None:
        logger.info('worker_started', extra={'worker_id': settings.worker_id})
        while True:
            try:
                await self.process_due_schedules()
                job = await self.repo.claim_next_job(settings.worker_id, queue_name=settings.queue_name)
                if not job:
                    await asyncio.sleep(settings.poll_interval_seconds)
                    continue
                await self.handle_job(job)
            except Exception as exc:  # noqa: BLE001
                logger.exception('worker_loop_error: %s', exc)
                await asyncio.sleep(settings.poll_interval_seconds)

    async def process_due_schedules(self) -> None:
        due = await self.repo.list_due_schedules()
        if not due:
            return

        now = datetime.now(UTC)
        for schedule in due:
            run = await self.repo.create_run(mode='scheduled', search_config=schedule.get('payload', {}))
            await self.repo.enqueue_job(payload={'type': 'run_hunt', 'run_id': str(run['id'])}, run_id=run['id'])
            await self.repo.insert_run_event(
                run['id'],
                'info',
                'scheduler',
                'scheduled_run_created',
                f"Run created from schedule {schedule['name']}",
                {'schedule_id': str(schedule['id'])},
            )

            next_run = croniter(schedule['cron_expr'], now).get_next(datetime)
            await self.repo.update_schedule_execution(schedule['id'], last_run_at=now, next_run_at=next_run)

    async def handle_job(self, job: dict) -> None:
        queue_id = int(job['id'])
        payload = job.get('payload') or {}
        job_type = payload.get('type')

        try:
            if job_type == 'run_hunt':
                run_id = UUID(str(payload['run_id']))
                await self.execute_run(run_id)
            else:
                logger.warning('unknown_job_type', extra={'queue_id': queue_id, 'payload': payload})

            await self.repo.complete_job(queue_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception('job_failed', extra={'queue_id': queue_id, 'error': str(exc)})
            await self.repo.fail_job(queue_id, error=str(exc))

    async def execute_run(self, run_id: UUID) -> None:
        run = await self.repo.fetch_run(run_id)
        if not run:
            raise RuntimeError(f'run not found: {run_id}')

        if run['status'] == 'paused':
            manual = await self.repo.get_active_manual_action_for_run(run_id)
            if manual:
                logger.info('run_still_paused', extra={'run_id': str(run_id), 'manual_action_id': str(manual['id'])})
                return

        await self.repo.update_run_status(run_id, 'running', current_node='worker_start')
        await self.repo.insert_run_event(run_id, 'info', 'worker', 'run_started', 'Worker started run execution')

        existing_state = run.get('state_json') or {}
        if run.get('search_config') and not existing_state.get('search_config'):
            existing_state['search_config'] = run['search_config']

        result = await self.graph_runner.run(run_id, existing_state=existing_state)
        logger.info('run_completed', extra={'run_id': str(run_id), 'paused': result.get('pause_requested', False)})


async def main() -> None:
    settings.artifact_root.mkdir(parents=True, exist_ok=True)

    pool = await create_db_pool(settings.database_url)
    await init_db_schema(pool)
    repo = HuntRepo(pool)
    graph_runner = HuntGraphRunner(repo=repo, artifact_root=settings.artifact_root)

    worker = Worker(repo=repo, graph_runner=graph_runner)
    await worker.run_forever()


if __name__ == '__main__':
    asyncio.run(main())
