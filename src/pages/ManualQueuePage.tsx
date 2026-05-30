import { useMemo, useState } from 'react'
import { Badge, Button, Card, FilterChip, PageHeader } from '../components/ui'

function deriveUrgency(action: any): 'high' | 'medium' | 'low' {
  const source = `${action.action_type || ''} ${action.title || ''}`.toLowerCase()
  if (source.includes('captcha') || source.includes('challenge') || source.includes('blocked')) return 'high'
  if (source.includes('otp') || source.includes('verification')) return 'medium'
  return 'low'
}

export function ManualQueuePage({
  actions,
  onStart,
  onResolve,
}: {
  actions: any[]
  onStart: (id: string) => void
  onResolve: (id: string) => void
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all')

  const filteredActions = useMemo(() => {
    return actions.filter((action) => {
      if (statusFilter === 'all') return true
      return action.status === statusFilter
    })
  }, [actions, statusFilter])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manual Queue"
        subtitle="Grouped operator actions with urgency cues and fast resolution controls."
        actions={
          <div className="flex items-center gap-2">
            <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All
            </FilterChip>
            <FilterChip active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>
              Pending
            </FilterChip>
            <FilterChip active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')}>
              Resolved
            </FilterChip>
          </div>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[1.8fr_1.1fr_0.8fr_0.8fr_auto] gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-400 md:grid">
          <span>Queue Item</span>
          <span>Action Type</span>
          <span>Status</span>
          <span>Urgency</span>
          <span>Actions</span>
        </div>

        {filteredActions.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">No manual actions in this filter.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredActions.map((action) => {
              const urgency = deriveUrgency(action)

              return (
                <div key={action.id} className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1.8fr_1.1fr_0.8fr_0.8fr_auto] md:items-center">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{action.company || 'Unknown company'} - {action.title || 'Untitled item'}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{new Date(action.created_at).toLocaleString()}</p>
                    {action.session_url ? (
                      <a className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400" href={action.session_url} target="_blank" rel="noreferrer">
                        Open browser session
                      </a>
                    ) : null}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400">{action.action_type || 'manual_step'}</p>

                  <div>
                    <Badge tone={action.status === 'resolved' ? 'success' : action.status === 'pending' ? 'warning' : 'default'}>
                      {action.status || 'unknown'}
                    </Badge>
                  </div>

                  <div>
                    <Badge tone={urgency === 'high' ? 'danger' : urgency === 'medium' ? 'warning' : 'info'}>
                      {urgency}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                    <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => onStart(action.id)}>
                      Start Session
                    </Button>
                    <Button className="h-8 px-2 text-xs" onClick={() => onResolve(action.id)}>
                      Resolve
                    </Button>
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
