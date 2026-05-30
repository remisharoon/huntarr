import { useMemo, useState } from 'react'
import { ExternalLink, Eye, Send, Trash2, FileText, Clock, CheckCircle2 } from 'lucide-react'
import { Badge, Button, Card, IconButton, Input, PageHeader, SegmentedControl } from '../components/ui'

export function JobsPage({
  jobs,
  counts,
  onApplyNow,
  onViewJob,
  onDeleteAll,
}: {
  jobs: any[]
  counts: { total: number; new: number; queued: number; applied: number }
  onApplyNow: (id: string) => void
  onViewJob: (id: string) => void
  onDeleteAll: () => void
}) {
  const [query, setQuery] = useState('')
  const [scoreBand, setScoreBand] = useState<'all' | 'high' | 'medium'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'queued' | 'applied'>('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return jobs.filter((job) => {
      if (scoreBand === 'high' && (job.score ?? 0) < 0.75) return false
      if (scoreBand === 'medium' && ((job.score ?? 0) < 0.5 || (job.score ?? 0) >= 0.75)) return false
      if (statusFilter !== 'all' && job.status !== statusFilter) return false

      if (!normalized) return true

      const fields = [job.title, job.company, job.location, job.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return fields.includes(normalized)
    })
  }, [jobs, query, scoreBand, statusFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied':
        return <Badge tone="success"><CheckCircle2 size={12} className="mr-1" />Applied</Badge>
      case 'queued':
        return <Badge tone="warning"><Clock size={12} className="mr-1" />Queued</Badge>
      case 'new':
      default:
        return <Badge tone="default"><FileText size={12} className="mr-1" />New</Badge>
    }
  }

  const handleDeleteAll = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    onDeleteAll()
    setShowDeleteConfirm(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Jobs"
        subtitle="Dense list optimized for quick scan and actions."
        actions={
          <>
            <Button
              variant="danger"
              onClick={handleDeleteAll}
              className="gap-2"
            >
              <Trash2 size={14} />
              Clear All
            </Button>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, company, location"
              className="w-64"
            />
            <SegmentedControl
              value={scoreBand}
              onChange={setScoreBand}
              options={[
                { value: 'all', label: 'All scores' },
                { value: 'high', label: 'High 0.75+' },
                { value: 'medium', label: 'Mid 0.5-0.74' },
              ]}
            />
          </>
        }
      />

      {/* Overall Status Display */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          All ({counts.total})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('new')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'new'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          New ({counts.new})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('queued')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'queued'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Queued ({counts.queued})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('applied')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            statusFilter === 'applied'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Applied ({counts.applied})
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[1.7fr_1fr_0.6fr_0.9fr_1fr_0.8fr_auto] gap-2 border-b border-border bg-elevated/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted md:grid">
          <span>Role</span>
          <span>Company</span>
          <span>Score</span>
          <span>Status</span>
          <span>Location</span>
          <span>Source</span>
          <span>Actions</span>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">No jobs match this filter.</div>
        ) : (
          <div className="divide-y divide-border">
            {filteredJobs.map((job) => {
              const score = Math.round(((job.score ?? 0) as number) * 100) / 100
              return (
                <div key={job.id} className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1.7fr_1fr_0.6fr_0.9fr_1fr_0.8fr_auto] md:items-center">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => onViewJob(job.id)}
                  >
                    <p className="truncate font-semibold text-text">{job.title || 'Untitled role'}</p>
                    <p className="mt-1 text-xs text-muted md:hidden">{job.company || 'Unknown company'}</p>
                  </button>

                  <p className="hidden text-sm text-text md:block">{job.company || 'Unknown company'}</p>

                  <div>
                    <Badge tone={score >= 0.75 ? 'success' : score >= 0.5 ? 'warning' : 'default'}>
                      {Number.isFinite(score) ? score.toFixed(2) : 'N/A'}
                    </Badge>
                  </div>

                  <div>
                    {getStatusBadge(job.status || 'new')}
                  </div>

                  <p className="text-sm text-muted">{job.location || 'N/A'}</p>

                  <p className="text-sm text-muted">{job.source || 'unknown'}</p>

                  <div className="flex items-center justify-start gap-1 md:justify-end">
                    <Button
                      onClick={() => onApplyNow(job.id)}
                      className="h-8 px-2 text-xs"
                    >
                      <Send size={14} />
                      Apply
                    </Button>
                    <IconButton title="View details" onClick={() => onViewJob(job.id)}>
                      <Eye size={14} />
                    </IconButton>
                    <IconButton
                      title="Open source"
                      onClick={() => {
                        if (!job.url) return
                        window.open(job.url, '_blank', 'noreferrer')
                      }}
                    >
                      <ExternalLink size={14} />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Delete All Jobs</h3>
            <p className="text-sm text-muted mb-6">
              Are you sure you want to delete {jobs.length} jobs and all related data (applications, scores, manual actions)? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
              >
                Delete All
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
