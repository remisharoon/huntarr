import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { MoreHorizontal, PauseCircle, PlayCircle, RotateCcw, Wrench } from 'lucide-react'
import type { Run, RunFilterState, RunSortKey, SortDirection } from '../types'
import { Badge, Button, Card, IconButton, PageHeader, SegmentedControl } from '../components/ui'
import { cn } from '../lib/utils'

interface RunsPageProps {
  runs: Run[]
  jobs: any[]
  applications: any[]
  manualActions: any[]
  onSelectRun: (runId: string) => void
  onPauseRun: (runId: string) => Promise<void> | void
  onResumeRun: (runId: string) => Promise<void> | void
}

const statusSortOrder: Record<Run['status'], number> = {
  failed: 0,
  running: 1,
  paused: 2,
  queued: 3,
  completed: 4,
}

function getDurationSeconds(run: Run): number {
  if (!run.started_at) return 0
  const start = new Date(run.started_at).getTime()
  const end = run.completed_at ? new Date(run.completed_at).getTime() : Date.now()
  return Math.max(0, Math.floor((end - start) / 1000))
}

function formatDuration(seconds: number): string {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) return '-'
  return new Date(dateValue).toLocaleString()
}

function statusTone(status: Run['status']): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'info'
  if (status === 'paused') return 'warning'
  return 'default'
}

export function RunsPage({ runs, jobs, applications, manualActions, onSelectRun, onPauseRun, onResumeRun }: RunsPageProps) {
  const [filters, setFilters] = useState<RunFilterState>({ status: 'all', mode: 'all', query: '', dateScope: 'all' })
  const [sortKey, setSortKey] = useState<RunSortKey>('started_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [busyRunId, setBusyRunId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onFocusSearch = () => {
      searchRef.current?.focus()
      searchRef.current?.select()
    }

    window.addEventListener('huntarr:focus-runs-search', onFocusSearch)
    return () => window.removeEventListener('huntarr:focus-runs-search', onFocusSearch)
  }, [])

  const filteredAndSortedRuns = useMemo(() => {
    const now = Date.now()

    const filtered = runs.filter((run) => {
      if (filters.status !== 'all' && run.status !== filters.status) return false
      if (filters.mode !== 'all' && run.mode !== filters.mode) return false

      if (filters.dateScope !== 'all') {
        const scopeMs =
          filters.dateScope === '24h' ? 24 * 60 * 60 * 1000 : filters.dateScope === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000

        const runDate = run.started_at ? new Date(run.started_at).getTime() : new Date(run.updated_at).getTime()
        if (now - runDate > scopeMs) return false
      }

      const normalized = filters.query.trim().toLowerCase()
      if (!normalized) return true

      const queryBase = [run.id, run.mode, run.status, run.current_node || ''].join(' ').toLowerCase()
      return queryBase.includes(normalized)
    })

    const sorted = [...filtered].sort((a, b) => {
      let compare = 0

      if (sortKey === 'started_at') {
        const aDate = a.started_at ? new Date(a.started_at).getTime() : new Date(a.updated_at).getTime()
        const bDate = b.started_at ? new Date(b.started_at).getTime() : new Date(b.updated_at).getTime()
        compare = aDate - bDate
      } else if (sortKey === 'duration') {
        compare = getDurationSeconds(a) - getDurationSeconds(b)
      } else {
        compare = statusSortOrder[a.status] - statusSortOrder[b.status]
      }

      return sortDirection === 'asc' ? compare : compare * -1
    })

    return sorted
  }, [filters, runs, sortDirection, sortKey])

  useEffect(() => {
    if (!filteredAndSortedRuns.length) {
      setFocusedIndex(-1)
      return
    }

    if (focusedIndex >= filteredAndSortedRuns.length) {
      setFocusedIndex(filteredAndSortedRuns.length - 1)
    }
  }, [filteredAndSortedRuns, focusedIndex])

  const toggleExpanded = (runId: string) => {
    setExpandedRows((previous) => {
      const next = new Set(previous)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }

  const handleRunAction = async (runId: string, action: 'pause' | 'resume') => {
    setBusyRunId(runId)
    setActionError(null)
    try {
      if (action === 'pause') {
        await Promise.resolve(onPauseRun(runId))
      } else {
        await Promise.resolve(onResumeRun(runId))
      }
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to execute run action')
    } finally {
      setBusyRunId(null)
    }
  }

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const isTypingTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      !!target.closest('button')

    if (event.key.toLowerCase() === 'f' && !isTypingTarget) {
      event.preventDefault()
      searchRef.current?.focus()
      return
    }

    if (!filteredAndSortedRuns.length || isTypingTarget) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, filteredAndSortedRuns.length - 1)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedIndex((prev) => Math.max(prev - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const run = filteredAndSortedRuns[focusedIndex]
      if (run) {
        toggleExpanded(run.id)
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setFocusedIndex(-1)
      setExpandedRows(new Set())
    }
  }

  return (
    <div className="space-y-4" tabIndex={0} onKeyDown={onGridKeyDown}>
      <PageHeader
        title="Pipelines (Runs)"
        subtitle="Dense pipeline table with filtering, sort controls, and expandable run insight rows."
      />

      <Card className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input
            ref={searchRef}
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            placeholder="Search by run id or current node"
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value as RunFilterState['status'] })}
            className="rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
          >
            <option value="all">All statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={filters.mode}
            onChange={(event) => setFilters({ ...filters, mode: event.target.value as RunFilterState['mode'] })}
            className="rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
          >
            <option value="all">All modes</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <select
            value={filters.dateScope}
            onChange={(event) => setFilters({ ...filters, dateScope: event.target.value as RunFilterState['dateScope'] })}
            className="rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
          >
            <option value="all">All time</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={sortKey}
            onChange={setSortKey}
            options={[
              { value: 'started_at', label: 'Sort: Start' },
              { value: 'duration', label: 'Sort: Duration' },
              { value: 'status', label: 'Sort: Status' },
            ]}
          />
          <SegmentedControl
            value={sortDirection}
            onChange={setSortDirection}
            options={[
              { value: 'desc', label: 'Desc' },
              { value: 'asc', label: 'Asc' },
            ]}
          />
          <Badge tone="default">{filteredAndSortedRuns.length} rows</Badge>
          <p className="text-xs text-muted">Use Up/Down + Enter, press f to focus search.</p>
        </div>

        {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr_1fr_0.8fr_auto] gap-2 border-b border-border bg-elevated/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted md:grid">
          <span>Pipeline</span>
          <span>Status</span>
          <span>Workflow/Mode</span>
          <span>Current Node</span>
          <span>Start</span>
          <span>Duration</span>
          <span>Actions</span>
        </div>

        {filteredAndSortedRuns.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">No runs match this filter combination.</div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAndSortedRuns.map((run, index) => {
              const isExpanded = expandedRows.has(run.id)
              const isFocused = focusedIndex === index
              const duration = getDurationSeconds(run)
              const relatedApplications = applications.filter((application) => application.run_id === run.id)
              const relatedManual = manualActions.filter((action) => action.run_id === run.id)
              const relatedJobs = jobs.filter((job) => job.run_id === run.id || job.last_run_id === run.id)

              return (
                <div key={run.id} className={cn('transition', isFocused ? 'bg-accent/10' : 'bg-transparent')}>
                  <div
                    className="grid w-full grid-cols-1 gap-2 px-4 py-3 text-left md:grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr_1fr_0.8fr_auto] md:items-center"
                    onClick={() => {
                      setFocusedIndex(index)
                      toggleExpanded(run.id)
                    }}
                  >
                    <div>
                      <p className="font-semibold text-text">Run {String(run.id).slice(0, 10)}</p>
                      <p className="text-xs text-muted">{run.error ? `Error: ${run.error}` : 'No run error'}</p>
                    </div>
                    <div>
                      <Badge tone={statusTone(run.status)}>{run.status}</Badge>
                    </div>
                    <p className="text-sm text-muted">{run.mode}</p>
                    <p className="truncate text-sm text-muted">{run.current_node || 'N/A'}</p>
                    <p className="text-sm text-muted">{formatDate(run.started_at || run.updated_at)}</p>
                    <p className="text-sm text-muted">{formatDuration(duration)}</p>
                    <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                      {run.status === 'running' ? (
                        <IconButton
                          title="Pause run"
                          onClick={() => handleRunAction(run.id, 'pause')}
                          disabled={busyRunId === run.id}
                        >
                          <PauseCircle size={15} />
                        </IconButton>
                      ) : null}
                      {run.status === 'paused' ? (
                        <IconButton
                          title="Resume run"
                          onClick={() => handleRunAction(run.id, 'resume')}
                          disabled={busyRunId === run.id}
                        >
                          <PlayCircle size={15} />
                        </IconButton>
                      ) : null}
                      <button
                        type="button"
                        title="Coming soon"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition hover:bg-elevated"
                      >
                        <RotateCcw size={15} />
                        <span className="sr-only">Coming soon</span>
                      </button>
                      <button
                        type="button"
                        title="Coming soon"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition hover:bg-elevated"
                      >
                        <Wrench size={15} />
                        <span className="sr-only">Coming soon</span>
                      </button>
                      <button
                        type="button"
                        title="Coming soon"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition hover:bg-elevated"
                      >
                        <MoreHorizontal size={15} />
                        <span className="sr-only">Coming soon</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'grid overflow-hidden px-4 transition-[grid-template-rows,opacity,margin] duration-200',
                      isExpanded ? 'mb-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-elevated/70 p-3">
                      <div className="grid gap-3 md:grid-cols-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.1em] text-muted">Jobs</p>
                          <p className="mt-1 text-sm font-semibold text-text">{relatedJobs.length || run.metrics.discovered || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.1em] text-muted">Applications</p>
                          <p className="mt-1 text-sm font-semibold text-text">{relatedApplications.length || run.metrics.applied}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.1em] text-muted">Manual actions</p>
                          <p className="mt-1 text-sm font-semibold text-text">{relatedManual.length || run.metrics.manual_required}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.1em] text-muted">Failed</p>
                          <p className="mt-1 text-sm font-semibold text-text">{run.metrics.failed}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => onSelectRun(run.id)}>
                          Open Run Detail
                        </Button>
                        <Badge tone="info">Updated: {formatDate(run.updated_at)}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
