import { useMemo, useState } from 'react'
import { ExternalLink, Eye, Send, Trash2, FileText, Clock, CheckCircle2 } from 'lucide-react'
import { Badge, Button, Card, IconButton, Input, PageHeader, SegmentedControl } from '../components/ui'

type AtsKind = 'greenhouse' | 'lever' | 'workday' | 'smartrecruiters' | 'ashby' | 'bamboohr' | 'icims' | 'taleo' | 'unknown'

function detectAtsKind(jobUrl: string | null | undefined): AtsKind {
  if (!jobUrl) return 'unknown'

  try {
    const host = new URL(jobUrl).hostname.toLowerCase()
    if (host.endsWith('greenhouse.io')) return 'greenhouse'
    if (host.endsWith('lever.co')) return 'lever'
    if (host.endsWith('myworkdayjobs.com') || host.includes('workday')) return 'workday'
    if (host.endsWith('smartrecruiters.com')) return 'smartrecruiters'
    if (host.endsWith('ashbyhq.com') || host.endsWith('ashby.so')) return 'ashby'
    if (host.endsWith('bamboohr.com')) return 'bamboohr'
    if (host.endsWith('icims.com')) return 'icims'
    if (host.endsWith('taleo.net') || host.endsWith('oraclecloud.com')) return 'taleo'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export function JobsPage({
  jobs,
  counts,
  noSteelAts,
  onApplyNow,
  onViewJob,
  onDeleteAll,
}: {
  jobs: any[]
  counts: { total: number; new: number; queued: number; applied: number }
  noSteelAts: string[]
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
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === 'all'
              ? 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }`}
        >
          All ({counts.total})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('new')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === 'new'
              ? 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }`}
        >
          New ({counts.new})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('queued')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === 'queued'
              ? 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }`}
        >
          Queued ({counts.queued})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('applied')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === 'applied'
              ? 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
              : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          }`}
        >
          Applied ({counts.applied})
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[1.6fr_1fr_0.6fr_0.9fr_1fr_0.85fr_0.9fr_auto] gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-400 md:grid">
          <span>Role</span>
          <span>Company</span>
          <span>Score</span>
          <span>Status</span>
          <span>Location</span>
          <span>Source</span>
          <span>Steel Need</span>
          <span>Actions</span>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">No jobs match this filter.</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredJobs.map((job) => {
              const score = Math.round(((job.score ?? 0) as number) * 100) / 100
              const ats = detectAtsKind(job.url)
              const steelBlocked = noSteelAts.includes(ats)
              return (
                <div key={job.id} className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1.6fr_1fr_0.6fr_0.9fr_1fr_0.85fr_0.9fr_auto] md:items-center">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => onViewJob(job.id)}
                  >
                    <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{job.title || 'Untitled role'}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 md:hidden">{job.company || 'Unknown company'}</p>
                  </button>

                  <p className="hidden text-sm text-gray-900 dark:text-gray-100 md:block">{job.company || 'Unknown company'}</p>

                  <div>
                    <Badge tone={score >= 0.75 ? 'success' : score >= 0.5 ? 'warning' : 'default'}>
                      {Number.isFinite(score) ? score.toFixed(2) : 'N/A'}
                    </Badge>
                  </div>

                  <div>
                    {getStatusBadge(job.status || 'new')}
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400">{job.location || 'N/A'}</p>

                  <p className="text-sm text-gray-600 dark:text-gray-400">{job.source || 'unknown'}</p>

                  <div>
                    {steelBlocked ? (
                      <Badge tone="info">No</Badge>
                    ) : (
                      <Badge tone="warning">Maybe</Badge>
                    )}
                  </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="mx-4 w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-2">Delete All Jobs</h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
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
