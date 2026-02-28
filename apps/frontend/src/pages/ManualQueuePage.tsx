import { Button, Card } from '../components/ui'

export function ManualQueuePage({
  actions,
  onStart,
  onResolve,
}: {
  actions: any[]
  onStart: (id: string) => void
  onResolve: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <Card key={action.id}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-lg">{action.company} — {action.title}</p>
              <p className="text-sm text-muted">{action.action_type} • {action.status}</p>
              {action.session_url ? (
                <a className="text-sm text-accent" href={action.session_url} target="_blank" rel="noreferrer">
                  Open noVNC session
                </a>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => onStart(action.id)}>Start Session</Button>
              <Button onClick={() => onResolve(action.id)}>Resolve + Resume</Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
