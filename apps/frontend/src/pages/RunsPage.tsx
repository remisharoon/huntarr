import { Card } from '../components/ui'

export function RunsPage({ runs }: { runs: any[] }) {
  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Card key={run.id}>
          <p className="font-display text-lg">Run {run.id}</p>
          <p className="text-sm text-muted">
            {run.status} • {run.mode} • node {run.current_node || 'n/a'}
          </p>
        </Card>
      ))}
    </div>
  )
}
