import { AlertCircle, ArrowLeft, Copy, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Application, ManualAction, Run, RunEvent } from '../types'
import { api, subscribeToRunEvents } from '../lib/api'
import { Button, Card } from '../components/ui'

interface RunDetailPageProps {
  runId: string
  onBack: () => void
}

export function RunDetailPage({ runId, onBack }: RunDetailPageProps) {
  const [run, setRun] = useState<Run | null>(null)
  const [events, setEvents] = useState<RunEvent[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [manualActions, setManualActions] = useState<ManualAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventFilters, setEventFilters] = useState({
    level: 'all',
  })
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setError(null)
        const [runData, eventsData, appsData, actionsData] = await Promise.all([
          api.getRun(runId),
          api.getRunEvents(runId, 50, 0),
          api.getRunApplications(runId),
          api.getRunManualActions(runId),
        ])
        setRun(runData)
        setEvents(eventsData)
        setApplications(appsData.items)
        setManualActions(actionsData.items)
        setLoading(false)
      } catch (err: any) {
        setError(err.message ?? 'Failed to load run details')
        setLoading(false)
      }
    }

    loadData()
  }, [runId])

  useEffect(() => {
    if (run?.status !== 'running') return

    const unsubscribe = subscribeToRunEvents(
      runId,
      (newEvent) => {
        setEvents((prev) => [...prev, newEvent])
        if (autoScroll) {
          setTimeout(() => {
            eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
      },
      (err) => console.error('SSE error:', err)
    )

    return unsubscribe
  }, [runId, run?.status, autoScroll])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (eventFilters.level !== 'all' && event.level !== eventFilters.level) return false
      return true
    })
  }, [events, eventFilters])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      queued: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
      running: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300',
      paused: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300',
      completed: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300',
      failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300',
    }
    return colors[status] || 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
  }

  const calculateDuration = () => {
    if (!run || !run.started_at) return '-'
    const start = new Date(run.started_at)
    const end = run.completed_at ? new Date(run.completed_at) : new Date()
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000 / 60)
    return `${diff} minutes`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString()
  }

  const copyRunId = () => {
    navigator.clipboard.writeText(runId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Loading run details...</p>
      </div>
    )
  }

  if (error || !run) {
    return (
      <Card className="border-red-200 p-6 text-red-700 dark:border-red-900/50 dark:text-red-300">
        {error || 'Run not found'}
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1">
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Run {run.id}
                <button onClick={copyRunId} className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400" title="Copy ID">
                  <Copy className="w-4 h-4" />
                </button>
                {copied && <span className="text-xs text-blue-600 dark:text-blue-400">Copied!</span>}
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full border px-2 py-1 text-xs ${getStatusColor(run.status)}`}>
                  {run.status}
                </span>
                <span className="capitalize text-gray-600 dark:text-gray-400">{run.mode}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Started</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(run.started_at)}</p>
            </div>
            {run.completed_at && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">Completed</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(run.completed_at)}</p>
              </div>
            )}
            <div>
              <p className="text-gray-600 dark:text-gray-400">Duration</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{calculateDuration()}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Last Updated</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(run.updated_at)}</p>
            </div>
          </div>

          {run.error && (
            <Card className="mt-4 border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                <div>
                  <h3 className="font-semibold text-red-700 dark:text-red-300">Run Failed</h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">{run.error}</p>
                </div>
              </div>
            </Card>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Metrics</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard label="Discovered" value={run.metrics.discovered ?? 0} color="accent" />
            <MetricCard label="Applied" value={run.metrics.applied} color="green" />
            <MetricCard label="Failed" value={run.metrics.failed} color="red" />
            <MetricCard label="Manual" value={run.metrics.manual_required} color="yellow" />
            <MetricCard label="Skipped" value={run.metrics.skipped} color="muted" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Search Configuration</h2>
          <div className="space-y-2 text-sm">
            <SearchConfigItem label="Role keywords" value={run.search_config.role_keywords} />
            <SearchConfigItem label="Locations" value={run.search_config.locations} />
            <SearchConfigItem label="Sources" value={run.search_config.sources} />
            <SearchConfigItem label="Remote only" value={run.search_config.remote_only} />
            <SearchConfigItem
              label="Salary range"
              value={
                run.search_config.salary_min && run.search_config.salary_max
                  ? `$${run.search_config.salary_min} - $${run.search_config.salary_max}`
                  : undefined
              }
            />
            <SearchConfigItem label="Max jobs per run" value={run.search_config.max_jobs_per_run} />
            <SearchConfigItem label="Aggressive scraping" value={run.search_config.aggressive_scraping} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Applications ({applications.length})
          </h2>
          {applications.length > 0 ? (
            <div className="space-y-2">
              {applications.map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">No applications yet</p>
          )}
        </Card>

        {manualActions.length > 0 && (
          <Card>
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Manual Actions ({manualActions.length})
            </h2>
            <div className="space-y-2">
              {manualActions.map((action) => (
                <ManualActionCard key={action.id} action={action} />
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="lg:col-span-1">
        <Card className="sticky top-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Event Log</h2>
            <Button variant="ghost" onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>

          <div className="mb-4 flex gap-2">
            <select
              value={eventFilters.level}
              onChange={(e) => setEventFilters({ ...eventFilters, level: e.target.value })}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="max-h-[600px] space-y-2 overflow-y-auto text-sm">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No events yet</p>
            )}
            <div ref={eventsEndRef} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    accent: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300',
    green: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300',
    muted: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
  }
  return (
    <div className={`rounded-lg border p-4 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-90">{label}</p>
    </div>
  )
}

function SearchConfigItem({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null
  const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
  return (
    <div className="flex">
      <span className="w-40 font-semibold text-gray-600 dark:text-gray-400">{label}:</span>
      <span className="text-gray-900 dark:text-gray-100">{displayValue}</span>
    </div>
  )
}

function ApplicationCard({ application }: { application: Application }) {
  return (
    <div className="cursor-pointer rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/60">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{application.job?.title || 'Unknown Job'}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{application.job?.company || 'Unknown Company'}</p>
      <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs ${getStatusColor(application.status)}`}>
        {application.status}
      </span>
    </div>
  )
}

function ManualActionCard({ action }: { action: ManualAction }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div className="flex justify-between">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{action.action_type}</span>
        <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${getStatusColor(action.status)}`}>
          {action.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{new Date(action.created_at).toLocaleString()}</p>
    </div>
  )
}

function EventCard({ event }: { event: RunEvent }) {
  const levelColors: Record<string, string> = {
    info: 'border-blue-200 text-blue-700 dark:border-blue-900/50 dark:text-blue-300',
    warning: 'border-yellow-200 text-yellow-700 dark:border-yellow-900/50 dark:text-yellow-300',
    error: 'border-red-200 text-red-700 dark:border-red-900/50 dark:text-red-300',
  }

  return (
    <div className={`rounded border border-l-2 bg-gray-50 p-2 dark:bg-gray-900/50 ${levelColors[event.level] || 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300'}`}>
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">{new Date(event.created_at).toLocaleTimeString()}</span>
        <span className="text-blue-600 dark:text-blue-400">{event.node || 'N/A'}</span>
      </div>
      <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{event.event_type}</p>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{event.message}</p>
      {event.payload_json && Object.keys(event.payload_json).length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs hover:text-blue-600 dark:hover:text-blue-400">Details</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs text-gray-700 dark:bg-gray-950 dark:text-gray-300">
            {JSON.stringify(event.payload_json, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    queued: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
    running: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300',
    paused: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300',
    completed: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300',
    failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300',
    submitted: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300',
    manual_required: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300',
    resolved: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300',
    pending: 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300',
    blocked: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300',
  }
  return colors[status] || 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
}
