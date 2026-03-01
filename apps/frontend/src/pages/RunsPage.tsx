import type { Run } from '../types'
import { Card } from '../components/ui'

interface RunsPageProps {
  runs: Run[]
  onSelectRun: (runId: string) => void
}

export function RunsPage({ runs, onSelectRun }: RunsPageProps) {
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

  const calculateDuration = (run: Run) => {
    if (!run.started_at) return '-'
    const start = new Date(run.started_at)
    const end = run.completed_at ? new Date(run.completed_at) : new Date()
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000 / 60)
    return `${diff}m`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Card
          key={run.id}
          className="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
          onClick={() => onSelectRun(run.id)}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-display text-lg font-semibold">
              Run {run.id.slice(0, 8)}
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(run.status)}`}>
              {run.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted mb-2">
            <span className="capitalize">{run.mode}</span>
            <span>•</span>
            <span>{run.current_node || 'N/A'}</span>
            <span>•</span>
            <span>{calculateDuration(run)}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-accent font-semibold">{run.metrics.applied} applied</span>
            <span className="text-muted">{run.metrics.discovered ?? 0} discovered</span>
            {run.metrics.failed > 0 && (
              <span className="text-red-500">{run.metrics.failed} failed</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
