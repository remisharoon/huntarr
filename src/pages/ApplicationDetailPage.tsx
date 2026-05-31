import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, ShieldAlert } from 'lucide-react'

import { Button, Card } from '../components/ui'
import { api } from '../lib/api'

function statusBadgeClass(status: string): string {
  if (status === 'submitted') {
    return 'border border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300'
  }
  if (status === 'failed') {
    return 'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300'
  }
  if (status === 'manual_required') {
    return 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300'
  }
  if (status === 'skipped') {
    return 'border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
  }
  return 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
}

function prettyStatus(status: string): string {
  if (!status) return 'unknown'
  return status.replace(/_/g, ' ')
}

export function ApplicationDetailPage({ applicationId, onBack }: { applicationId: string; onBack: () => void }) {
  const [application, setApplication] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchApplication = async () => {
      setLoading(true)
      try {
        const data = await api.getApplicationDetail(applicationId)
        setApplication(data)
      } catch (err: any) {
        setError(err.message ?? 'Failed to load application details')
      } finally {
        setLoading(false)
      }
    }
    fetchApplication()
  }, [applicationId])

  if (loading) {
    return <Card className="p-8 text-center">Loading...</Card>
  }

  if (error) {
    return <Card className="p-8 text-center text-red-700 dark:text-red-300">{error}</Card>
  }

  if (!application) {
    return <Card className="p-8 text-center">Application not found</Card>
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
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Application Details</h1>
          <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm ${statusBadgeClass(application.status)}`}>
            {prettyStatus(application.status)}
          </p>
        </div>

        <section>
          <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Application Status</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Status:</span> {prettyStatus(application.status)}</p>
            {application.source_portal && <p><span className="font-semibold">Source Portal:</span> {application.source_portal}</p>}
            {application.error_code && <p><span className="font-semibold">Error:</span> {application.error_code}</p>}
            {application.confirmation_text && (
              <div>
                <span className="font-semibold">Confirmation:</span>
                <p className="mt-1 text-gray-600 dark:text-gray-400">{application.confirmation_text}</p>
              </div>
            )}
            <p><span className="font-semibold">Submitted:</span> {application.submitted_at ? new Date(application.submitted_at).toLocaleString() : 'Not submitted'}</p>
            <p><span className="font-semibold">Created:</span> {new Date(application.created_at).toLocaleString()}</p>
          </div>
        </section>

        {application.job && (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Job Details</h2>
            <Card className="space-y-2">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{application.job.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {application.job.company} • {application.job.location || 'N/A'}
              </p>
              <p className="text-sm">
                Score: <span className="font-semibold">{application.job.score ? Math.round(application.job.score * 10) / 10 : 'N/A'}</span>
              </p>
              <a href={application.job.url} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-blue-600 dark:text-blue-400">
                View Job Posting →
              </a>
            </Card>
          </section>
        )}

        {application.answers && application.answers.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Application Answers ({application.answers.length})</h2>
            <div className="space-y-3">
              {application.answers.map((answer: any, idx: number) => (
                <Card key={idx} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-sm">Q: {answer.question}</p>
                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${
                      answer.confidence > 0.8 ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300' :
                      answer.confidence > 0.5 ? 'border border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300' :
                      'border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300'
                    }`}>
                      {Math.round(answer.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">A: {answer.answer}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(answer.created_at).toLocaleString()}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {application.generated_documents && application.generated_documents.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Generated Documents ({application.generated_documents.length})</h2>
            <div className="space-y-2">
              {application.generated_documents.map((doc: any) => (
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

        {application.artifacts && Object.keys(application.artifacts).length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Artifacts</h2>
            <Card>
              <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{JSON.stringify(application.artifacts, null, 2)}</pre>
            </Card>
          </section>
        ) : null}

        {application.manual_actions && application.manual_actions.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Manual Actions ({application.manual_actions.length})</h2>
            <div className="space-y-2">
              {application.manual_actions.map((action: any) => (
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

        {application.run && (
          <section>
            <h2 className="mb-3 text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Run Details</h2>
            <Card className="text-sm">
              <p><span className="font-semibold">Run ID:</span> {application.run.id}</p>
              <p><span className="font-semibold">Status:</span> {application.run.status}</p>
              <p><span className="font-semibold">Mode:</span> {application.run.mode}</p>
              <p><span className="font-semibold">Current Node:</span> {application.run.current_node || 'N/A'}</p>
            </Card>
          </section>
        )}
      </Card>
    </div>
  )
}
