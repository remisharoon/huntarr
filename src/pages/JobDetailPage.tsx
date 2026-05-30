import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, ShieldAlert } from 'lucide-react'

import { Button, Card } from '../components/ui'
import { api } from '../lib/api'

export function JobDetailPage({ jobId, onBack, onViewApplication }: { jobId: string; onBack: () => void; onViewApplication: (id: string) => void }) {
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchJob = async () => {
      setLoading(true)
      try {
        const data = await api.getJobDetail(jobId)
        setJob(data)
      } catch (err: any) {
        setError(err.message ?? 'Failed to load job details')
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [jobId])

  if (loading) {
    return <Card className="p-8 text-center">Loading...</Card>
  }

  if (error) {
    return <Card className="p-8 text-center text-red-600">{error}</Card>
  }

  if (!job) {
    return <Card className="p-8 text-center">Job not found</Card>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="ghost" className="border border-black/10">
          <ArrowLeft size={16} className="mr-2" />
          Back to Jobs
        </Button>
      </div>

      <Card className="space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl">{job.title}</h1>
          <p className="text-lg text-muted">{job.company}</p>
        </div>

        <section>
          <h2 className="font-display text-xl mb-3">Job Details</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Location:</span> {job.location || 'N/A'}</p>
            <p><span className="font-semibold">Source:</span> {job.source}</p>
            <p><span className="font-semibold">Score:</span> {job.score ? Math.round(job.score * 10) / 10 : 'N/A'}</p>
            <p><span className="font-semibold">Posted:</span> {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'N/A'}</p>
            <a href={job.url} target="_blank" rel="noreferrer" className="text-accent block mt-2">
              View Original Posting →
            </a>
          </div>
        </section>

        {job.description ? (
          <section>
            <h2 className="font-display text-xl mb-3">Description</h2>
            <div className="text-sm text-muted whitespace-pre-wrap">{job.description}</div>
          </section>
        ) : null}

        {job.applications && job.applications.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Applications ({job.applications.length})</h2>
            <div className="space-y-2">
              {job.applications.map((app: any) => (
                <Card key={app.id} className="flex items-center justify-between cursor-pointer hover:bg-black/[0.02]">
                  <div className="text-sm">
                    <span className="font-semibold">{app.status}</span>
                    <span className="text-muted ml-2">
                      {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'Not submitted'}
                    </span>
                  </div>
                  <Button onClick={() => onViewApplication(app.id)} variant="ghost" className="border border-black/10">View →</Button>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {job.manual_actions && job.manual_actions.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Manual Actions ({job.manual_actions.length})</h2>
            <div className="space-y-2">
              {job.manual_actions.map((action: any) => (
                <Card key={action.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-2">
                      <ShieldAlert size={16} />
                      {action.action_type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      action.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      action.status === 'resolved' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="text-muted mt-1">{new Date(action.created_at).toLocaleString()}</p>
                  {action.session_url ? (
                    <a href={action.session_url} target="_blank" rel="noreferrer" className="text-accent text-xs mt-1 block">
                      Session URL →
                    </a>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {job.generated_documents && job.generated_documents.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Generated Documents ({job.generated_documents.length})</h2>
            <div className="space-y-2">
              {job.generated_documents.map((doc: any) => (
                <Card key={doc.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-2">
                      <FileText size={16} />
                      {doc.doc_type}
                    </span>
                    <span className="text-muted">{new Date(doc.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-muted text-xs mt-1">{doc.path}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {job.explanation && Object.keys(job.explanation).length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Score Explanation</h2>
            <Card className="text-sm">
              <pre className="text-muted whitespace-pre-wrap">{JSON.stringify(job.explanation, null, 2)}</pre>
            </Card>
          </section>
        ) : null}
      </Card>
    </div>
  )
}
