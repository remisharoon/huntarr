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
    return <Card className="p-8 text-center text-red-700 dark:text-red-300">{error}</Card>
  }

  if (!job) {
    return <Card className="p-8 text-center">Job not found</Card>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="ghost" className="border border-gray-200 dark:border-gray-700">
          <ArrowLeft size={16} className="mr-2" />
          Back to Jobs
        </Button>
      </div>

      <Card className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{job.title}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">{job.company}</p>
        </div>

        <section>
          <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Job Details</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Location:</span> {job.location || 'N/A'}</p>
            <p><span className="font-semibold">Source:</span> {job.source}</p>
            <p><span className="font-semibold">Score:</span> {job.score ? Math.round(job.score * 10) / 10 : 'N/A'}</p>
            <p><span className="font-semibold">Posted:</span> {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'N/A'}</p>
            <a href={job.url} target="_blank" rel="noreferrer" className="mt-2 block text-blue-600 dark:text-blue-400">
              View Original Posting →
            </a>
          </div>
        </section>

        {job.description ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Description</h2>
            <div className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{job.description}</div>
          </section>
        ) : null}

        {job.applications && job.applications.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Applications ({job.applications.length})</h2>
            <div className="space-y-2">
              {job.applications.map((app: any) => (
                <Card key={app.id} className="flex cursor-pointer items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="text-sm">
                    <span className="font-semibold">{app.status}</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'Not submitted'}
                    </span>
                  </div>
                  <Button onClick={() => onViewApplication(app.id)} variant="ghost" className="border border-gray-200 dark:border-gray-700">View →</Button>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {job.manual_actions && job.manual_actions.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Manual Actions ({job.manual_actions.length})</h2>
            <div className="space-y-2">
              {job.manual_actions.map((action: any) => (
                <Card key={action.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-2">
                      <ShieldAlert size={16} />
                      {action.action_type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      action.status === 'pending' ? 'border border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300' :
                      action.status === 'resolved' ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300' :
                      'border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                    }`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-600 dark:text-gray-400">{new Date(action.created_at).toLocaleString()}</p>
                  {action.session_url ? (
                    <a href={action.session_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-blue-600 dark:text-blue-400">
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
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Generated Documents ({job.generated_documents.length})</h2>
            <div className="space-y-2">
              {job.generated_documents.map((doc: any) => (
                <Card key={doc.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-2">
                      <FileText size={16} />
                      {doc.doc_type}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{new Date(doc.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{doc.path}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {job.explanation && Object.keys(job.explanation).length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Score Explanation</h2>
            <Card className="text-sm">
              <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400">{JSON.stringify(job.explanation, null, 2)}</pre>
            </Card>
          </section>
        ) : null}
      </Card>
    </div>
  )
}
