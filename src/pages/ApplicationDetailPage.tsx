import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, ShieldAlert } from 'lucide-react'

import { Button, Card } from '../components/ui'
import { api } from '../lib/api'

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
    return <Card className="p-8 text-center text-red-600">{error}</Card>
  }

  if (!application) {
    return <Card className="p-8 text-center">Application not found</Card>
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
          <h1 className="font-display text-2xl">Application Details</h1>
          <p className={`inline-block px-3 py-1 rounded-full text-sm mt-2 ${
            application.status === 'submitted' ? 'bg-green-100 text-green-800' :
            application.status === 'failed' ? 'bg-red-100 text-red-800' :
            application.status === 'skipped' ? 'bg-gray-100 text-gray-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {application.status}
          </p>
        </div>

        <section>
          <h2 className="font-display text-xl mb-3">Application Status</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Status:</span> {application.status}</p>
            {application.source_portal && <p><span className="font-semibold">Source Portal:</span> {application.source_portal}</p>}
            {application.error_code && <p><span className="font-semibold">Error:</span> {application.error_code}</p>}
            {application.confirmation_text && (
              <div>
                <span className="font-semibold">Confirmation:</span>
                <p className="mt-1 text-muted">{application.confirmation_text}</p>
              </div>
            )}
            <p><span className="font-semibold">Submitted:</span> {application.submitted_at ? new Date(application.submitted_at).toLocaleString() : 'Not submitted'}</p>
            <p><span className="font-semibold">Created:</span> {new Date(application.created_at).toLocaleString()}</p>
          </div>
        </section>

        {application.job && (
          <section>
            <h2 className="font-display text-xl mb-3">Job Details</h2>
            <Card className="space-y-2">
              <p className="font-display text-lg">{application.job.title}</p>
              <p className="text-sm text-muted">
                {application.job.company} • {application.job.location || 'N/A'}
              </p>
              <p className="text-sm">
                Score: <span className="font-semibold">{application.job.score ? Math.round(application.job.score * 10) / 10 : 'N/A'}</span>
              </p>
              <a href={application.job.url} target="_blank" rel="noreferrer" className="text-accent text-sm block mt-2">
                View Job Posting →
              </a>
            </Card>
          </section>
        )}

        {application.answers && application.answers.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Application Answers ({application.answers.length})</h2>
            <div className="space-y-3">
              {application.answers.map((answer: any, idx: number) => (
                <Card key={idx} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-sm">Q: {answer.question}</p>
                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${
                      answer.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                      answer.confidence > 0.5 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {Math.round(answer.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-muted">A: {answer.answer}</p>
                  <p className="text-xs text-muted">{new Date(answer.created_at).toLocaleString()}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {application.generated_documents && application.generated_documents.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Generated Documents ({application.generated_documents.length})</h2>
            <div className="space-y-2">
              {application.generated_documents.map((doc: any) => (
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

        {application.artifacts && Object.keys(application.artifacts).length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Artifacts</h2>
            <Card>
              <pre className="text-sm text-muted whitespace-pre-wrap">{JSON.stringify(application.artifacts, null, 2)}</pre>
            </Card>
          </section>
        ) : null}

        {application.manual_actions && application.manual_actions.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-3">Manual Actions ({application.manual_actions.length})</h2>
            <div className="space-y-2">
              {application.manual_actions.map((action: any) => (
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

        {application.run && (
          <section>
            <h2 className="font-display text-xl mb-3">Run Details</h2>
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
