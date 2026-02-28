import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Briefcase, PlayCircle, ShieldAlert, UserRound, Workflow } from 'lucide-react'

import { Button, Card } from './components/ui'
import { api } from './lib/api'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { DashboardPage } from './pages/DashboardPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { ManualQueuePage } from './pages/ManualQueuePage'
import { ProfilePage } from './pages/ProfilePage'
import { RunsPage } from './pages/RunsPage'

type View = 'dashboard' | 'jobs' | 'manual' | 'profile' | 'runs' | 'job-detail' | 'application-detail'

const tabs: Array<{ id: View; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Workflow },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'manual', label: 'Manual Queue', icon: ShieldAlert },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'runs', label: 'Runs', icon: PlayCircle },
]

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [runs, setRuns] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [manualActions, setManualActions] = useState<any[]>([])
  const [profile, setProfile] = useState<any>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setError(null)
      const [runsRes, jobsRes, appRes, manualRes, profileRes] = await Promise.all([
        api.listRuns(),
        api.listJobs(),
        api.listApplications(),
        api.listManualActions(),
        api.getProfile(),
      ])
      setRuns(runsRes.items)
      setJobs(jobsRes.items)
      setApplications(appRes.items)
      setManualActions(manualRes.items)
      setProfile(profileRes)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load data')
    }
  }

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 8000)
    return () => clearInterval(timer)
  }, [])

  const latestRunId = useMemo(() => (runs[0]?.id ? String(runs[0].id) : null), [runs])

  const startHunt = async () => {
    setBusy(true)
    try {
      await api.createRun({ mode: 'manual', search_config: {} })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const onApplyNow = async (jobId: string) => {
    await api.applyNow(jobId)
    await refresh()
  }

  const onStartManual = async (id: string) => {
    await api.startManualSession(id)
    await refresh()
  }

  const onResolveManual = async (id: string) => {
    await api.resolveManualAction(id)
    await refresh()
  }

  const onViewJob = (jobId: string) => {
    setSelectedJobId(jobId)
    setView('job-detail')
  }

  const onViewApplication = (applicationId: string) => {
    setSelectedApplicationId(applicationId)
    setView('application-detail')
  }

  const onBack = () => {
    setSelectedJobId(null)
    setSelectedApplicationId(null)
    setView('jobs')
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-ink p-6 text-white shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-3xl">huntarr</p>
          <p className="text-sm text-white/80">Automated job research and application command center</p>
          {latestRunId ? <p className="mt-2 text-xs text-white/70">Latest run: {latestRunId}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button onClick={refresh} variant="ghost" className="border border-white/30 text-white hover:bg-white/10">
            Refresh
          </Button>
          <Button onClick={startHunt} disabled={busy} className="bg-accent text-white">
            Start Hunt
          </Button>
        </div>
      </header>

      {error ? <Card className="mb-4 border-red-200 text-red-700">{error}</Card> : null}

      <nav className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Button
              key={tab.id}
              variant={view === tab.id ? 'secondary' : 'ghost'}
              className={view === tab.id ? '' : 'border border-black/10'}
              onClick={() => setView(tab.id)}
            >
              <span className="inline-flex items-center gap-2">
                <Icon size={16} />
                {tab.label}
              </span>
            </Button>
          )
        })}
      </nav>

      {view === 'dashboard' ? <DashboardPage runs={runs} jobs={jobs} manualActions={manualActions} applications={applications} /> : null}
      {view === 'jobs' ? <JobsPage jobs={jobs} onApplyNow={onApplyNow} onViewJob={onViewJob} /> : null}
      {view === 'manual' ? <ManualQueuePage actions={manualActions} onStart={onStartManual} onResolve={onResolveManual} /> : null}
      {view === 'profile' ? <ProfilePage profile={profile} onSave={async (payload) => { await api.saveProfile(payload); await refresh() }} /> : null}
      {view === 'runs' ? <RunsPage runs={runs} /> : null}
      {view === 'job-detail' && selectedJobId ? (
        <JobDetailPage jobId={selectedJobId} onBack={onBack} onViewApplication={onViewApplication} />
      ) : null}
      {view === 'application-detail' && selectedApplicationId ? (
        <ApplicationDetailPage applicationId={selectedApplicationId} onBack={onBack} />
      ) : null}
    </div>
  )
}
