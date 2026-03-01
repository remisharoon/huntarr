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
      queued: 'bg-muted text-white',
      running: 'bg-accent text-white',
      paused: 'bg-yellow-500 text-white',
      completed: 'bg-green-500 text-white',
      failed: 'bg-red-500 text-white',
    }
    return colors[status] || 'bg-muted text-white'
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
        <p className="text-muted">Loading run details...</p>
      </div>
    )
  }

  if (error || !run) {
    return (
      <Card className="border-red-200 text-red-700 p-6">
        {error || 'Run not found'}
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold flex items-center gap-2">
                Run {run.id}
                <button onClick={copyRunId} className="text-muted hover:text-accent" title="Copy ID">
                  <Copy className="w-4 h-4" />
                </button>
                {copied && <span className="text-xs text-accent">Copied!</span>}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(run.status)}`}>
                  {run.status}
                </span>
                <span className="text-muted capitalize">{run.mode}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted">Started</p>
              <p className="font-semibold">{formatDate(run.started_at)}</p>
            </div>
            {run.completed_at && (
              <div>
                <p className="text-muted">Completed</p>
                <p className="font-semibold">{formatDate(run.completed_at)}</p>
              </div>
            )}
            <div>
              <p className="text-muted">Duration</p>
              <p className="font-semibold">{calculateDuration()}</p>
            </div>
            <div>
              <p className="text-muted">Last Updated</p>
              <p className="font-semibold">{formatDate(run.updated_at)}</p>
            </div>
          </div>

          {run.error && (
            <Card className="mt-4 border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-700">Run Failed</h3>
                  <p className="text-sm text-red-600 mt-1">{run.error}</p>
                </div>
              </div>
            </Card>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold mb-4">Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="Discovered" value={run.metrics.discovered ?? 0} color="accent" />
            <MetricCard label="Applied" value={run.metrics.applied} color="green" />
            <MetricCard label="Failed" value={run.metrics.failed} color="red" />
            <MetricCard label="Manual" value={run.metrics.manual_required} color="yellow" />
            <MetricCard label="Skipped" value={run.metrics.skipped} color="muted" />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold mb-4">Search Configuration</h2>
          <div className="space-y-2 text-sm">
            <SearchConfigItem label="Role keywords" value={run.search_config.role_keywords} />
            <SearchConfigItem label="Locations" value={run.search_config.locations} />
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
          <h2 className="font-display text-xl font-semibold mb-4">
            Applications ({applications.length})
          </h2>
          {applications.length > 0 ? (
            <div className="space-y-2">
              {applications.map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">No applications yet</p>
          )}
        </Card>

        {manualActions.length > 0 && (
          <Card>
            <h2 className="font-display text-xl font-semibold mb-4">
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Event Log</h2>
            <Button variant="ghost" onClick={() => setAutoScroll(!autoScroll)}>
              {autoScroll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex gap-2 mb-4">
            <select
              value={eventFilters.level}
              onChange={(e) => setEventFilters({ ...eventFilters, level: e.target.value })}
              className="text-sm border rounded px-2 py-1 bg-surface"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto text-sm">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))
            ) : (
              <p className="text-muted">No events yet</p>
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
    accent: 'bg-accent text-white',
    green: 'bg-green-500 text-white',
    red: 'bg-red-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    muted: 'bg-muted text-white',
  }
  return (
    <div className={`p-4 rounded-lg ${colors[color]} text-center`}>
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
      <span className="font-semibold w-40 text-muted">{label}:</span>
      <span>{displayValue}</span>
    </div>
  )
}

function ApplicationCard({ application }: { application: Application }) {
  return (
    <div className="p-3 border rounded hover:bg-surface cursor-pointer">
      <p className="font-semibold">{application.job?.title || 'Unknown Job'}</p>
      <p className="text-sm text-muted">{application.job?.company || 'Unknown Company'}</p>
      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(application.status)}`}>
        {application.status}
      </span>
    </div>
  )
}

function ManualActionCard({ action }: { action: ManualAction }) {
  return (
    <div className="p-3 border rounded">
      <div className="flex justify-between">
        <span className="font-semibold">{action.action_type}</span>
        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(action.status)}`}>
          {action.status}
        </span>
      </div>
      <p className="text-xs text-muted mt-1">{new Date(action.created_at).toLocaleString()}</p>
    </div>
  )
}

function EventCard({ event }: { event: RunEvent }) {
  const levelColors: Record<string, string> = {
    info: 'text-muted',
    warning: 'text-yellow-500',
    error: 'text-red-500',
  }

  return (
    <div className={`p-2 border-l-2 rounded ${levelColors[event.level] || 'text-muted'} border-${event.level === 'error' ? 'red-500' : event.level === 'warning' ? 'yellow-500' : 'accent'}`}>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{new Date(event.created_at).toLocaleTimeString()}</span>
        <span className="text-accent">{event.node || 'N/A'}</span>
      </div>
      <p className="font-medium mt-1">{event.event_type}</p>
      <p className="text-xs text-muted mt-1">{event.message}</p>
      {event.payload_json && Object.keys(event.payload_json).length > 0 && (
        <details className="mt-1">
          <summary className="text-xs cursor-pointer hover:text-accent">Details</summary>
          <pre className="text-xs mt-1 p-2 bg-surface rounded overflow-x-auto">
            {JSON.stringify(event.payload_json, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    queued: 'bg-muted text-white',
    running: 'bg-accent text-white',
    paused: 'bg-yellow-500 text-white',
    completed: 'bg-green-500 text-white',
    failed: 'bg-red-500 text-white',
  }
  return colors[status] || 'bg-muted text-white'
}
