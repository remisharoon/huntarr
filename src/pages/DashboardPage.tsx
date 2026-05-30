import { useMemo } from 'react'
import { Badge, Card, PageHeader } from '../components/ui'

export function DashboardPage({ runs, jobs, manualActions, applications }: { runs: any[]; jobs: any[]; manualActions: any[]; applications: any[] }) {
  const stats = useMemo(
    () => [
      {
        label: 'Pipelines (Runs)',
        value: runs.length,
        helper: `${runs.filter((run) => run.status === 'running').length} running`,
      },
      {
        label: 'Tracked Jobs',
        value: jobs.length,
        helper: `${jobs.filter((job) => (job.score ?? 0) >= 0.7).length} high confidence`,
      },
      {
        label: 'Applications',
        value: applications.length,
        helper: `${applications.filter((app) => app.status === 'submitted').length} submitted`,
      },
      {
        label: 'Manual Queue',
        value: manualActions.filter((item) => item.status !== 'resolved').length,
        helper: `${manualActions.filter((item) => item.status === 'pending').length} pending`,
      },
    ],
    [runs, jobs, manualActions, applications],
  )

  const latestRuns = useMemo(() => runs.slice(0, 6), [runs])

  const unresolvedActions = useMemo(
    () => manualActions.filter((action) => action.status !== 'resolved').slice(0, 6),
    [manualActions],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operational Overview"
        subtitle="A dense view of throughput, queue pressure, and most recent pipeline activity."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} variant="muted" className="p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">{item.label}</p>
            <p className="mt-2 font-display text-3xl text-text">{item.value}</p>
            <p className="mt-1 text-xs text-muted">{item.helper}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-text">Recent Pipelines</h2>
            <Badge tone="info">{latestRuns.length} showing</Badge>
          </div>
          {latestRuns.length === 0 ? (
            <p className="text-sm text-muted">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {latestRuns.map((run) => (
                <div key={run.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-border bg-elevated/60 px-3 py-2 text-sm">
                  <p className="truncate font-semibold text-text">Run {String(run.id).slice(0, 10)}</p>
                  <Badge
                    tone={
                      run.status === 'completed'
                        ? 'success'
                        : run.status === 'failed'
                          ? 'danger'
                          : run.status === 'running'
                            ? 'info'
                            : run.status === 'paused'
                              ? 'warning'
                              : 'default'
                    }
                  >
                    {run.status}
                  </Badge>
                  <p className="text-xs text-muted">{run.current_node || 'N/A'}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-text">Manual Intervention Pressure</h2>
            <Badge tone={unresolvedActions.length > 0 ? 'warning' : 'success'}>
              {unresolvedActions.length > 0 ? 'Needs attention' : 'Healthy'}
            </Badge>
          </div>
          {unresolvedActions.length === 0 ? (
            <p className="text-sm text-muted">No unresolved manual actions.</p>
          ) : (
            <div className="space-y-2">
              {unresolvedActions.map((action) => (
                <div key={action.id} className="rounded-xl border border-border bg-elevated/60 px-3 py-2">
                  <p className="text-sm font-semibold text-text">{action.company || 'Unknown company'} - {action.title || 'Untitled action'}</p>
                  <p className="mt-1 text-xs text-muted">
                    {action.action_type || 'manual_step'} - {action.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
