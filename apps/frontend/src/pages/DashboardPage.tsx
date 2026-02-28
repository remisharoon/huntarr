import { useMemo } from 'react'
import { Card } from '../components/ui'

export function DashboardPage({ runs, jobs, manualActions, applications }: { runs: any[]; jobs: any[]; manualActions: any[]; applications: any[] }) {
  const stats = useMemo(
    () => [
      { label: 'Runs', value: runs.length },
      { label: 'Tracked Jobs', value: jobs.length },
      { label: 'Applications', value: applications.length },
      { label: 'Manual Queue', value: manualActions.filter((m) => m.status !== 'resolved').length },
    ],
    [runs, jobs, manualActions, applications],
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted">{item.label}</p>
            <p className="mt-2 text-3xl font-bold font-display">{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="font-display text-xl">System posture</h2>
        <p className="mt-2 text-sm text-muted">
          Huntarr is configured for aggressive public discovery, auto-submit mode, and manual noVNC intervention queue on challenge detection.
        </p>
      </Card>
    </div>
  )
}
