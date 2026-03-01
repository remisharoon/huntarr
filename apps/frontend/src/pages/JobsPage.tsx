import { useMemo, useState } from 'react'
import { ExternalLink, Eye, Send } from 'lucide-react'
import { Badge, Button, Card, IconButton, Input, PageHeader, SegmentedControl } from '../components/ui'

export function JobsPage({
  jobs,
  onApplyNow,
  onViewJob,
}: {
  jobs: any[]
  onApplyNow: (id: string) => void
  onViewJob: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [scoreBand, setScoreBand] = useState<'all' | 'high' | 'medium'>('all')

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return jobs.filter((job) => {
      if (scoreBand === 'high' && (job.score ?? 0) < 0.75) return false
      if (scoreBand === 'medium' && ((job.score ?? 0) < 0.5 || (job.score ?? 0) >= 0.75)) return false

      if (!normalized) return true

      const fields = [job.title, job.company, job.location, job.source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return fields.includes(normalized)
    })
  }, [jobs, query, scoreBand])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Jobs"
        subtitle="Dense list optimized for quick scan and actions."
        actions={
          <>
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

      <Card className="overflow-hidden p-0">
        <div className="hidden grid-cols-[1.7fr_1fr_0.6fr_1fr_0.8fr_auto] gap-2 border-b border-border bg-elevated/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted md:grid">
          <span>Role</span>
          <span>Company</span>
          <span>Score</span>
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
                <div key={job.id} className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1.7fr_1fr_0.6fr_1fr_0.8fr_auto] md:items-center">
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
    </div>
  )
}
