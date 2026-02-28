import { Button, Card } from '../components/ui'

export function JobsPage({ jobs, onApplyNow }: { jobs: any[]; onApplyNow: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Card key={job.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-lg">{job.title}</p>
            <p className="text-sm text-muted">
              {job.company} • {job.location || 'N/A'} • score {Math.round((job.score ?? 0) * 10) / 10}
            </p>
            <a className="text-sm text-accent" href={job.url} target="_blank" rel="noreferrer">
              {job.url}
            </a>
          </div>
          <Button onClick={() => onApplyNow(job.id)}>Apply Now</Button>
        </Card>
      ))}
    </div>
  )
}
