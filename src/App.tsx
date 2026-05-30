import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Briefcase,
  Menu,
  Moon,
  PlayCircle,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  UserRound,
  Workflow,
  X,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button, Card, IconButton } from './components/ui'
import { api } from './lib/api'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { DashboardPage } from './pages/DashboardPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { ManualQueuePage } from './pages/ManualQueuePage'
import { ProfilePage } from './pages/ProfilePage'
import { RunDetailPage } from './pages/RunDetailPage'
import { RunsPage } from './pages/RunsPage'
import { SettingsPage } from './pages/SettingsPage'
import type { Profile, ThemeMode } from './types'

type View = 'dashboard' | 'jobs' | 'manual' | 'profile' | 'runs' | 'settings' | 'job-detail' | 'application-detail' | 'run-detail'

function routePathForView(view: Extract<View, 'dashboard' | 'jobs' | 'manual' | 'profile' | 'runs' | 'settings'>): string {
  switch (view) {
    case 'dashboard':
      return '/'
    case 'jobs':
      return '/jobs'
    case 'manual':
      return '/manual'
    case 'profile':
      return '/profile'
    case 'runs':
      return '/runs'
    case 'settings':
      return '/settings'
  }
}

function resolveRoute(pathname: string): {
  view: View
  selectedJobId: string | null
  selectedApplicationId: string | null
  selectedRunId: string | null
} {
  if (pathname === '/' || pathname === '') {
    return { view: 'dashboard', selectedJobId: null, selectedApplicationId: null, selectedRunId: null }
  }
  if (pathname === '/jobs') {
    return { view: 'jobs', selectedJobId: null, selectedApplicationId: null, selectedRunId: null }
  }
  if (pathname.startsWith('/jobs/')) {
    const id = pathname.slice('/jobs/'.length)
    return { view: 'job-detail', selectedJobId: id || null, selectedApplicationId: null, selectedRunId: null }
  }
  if (pathname === '/manual') {
    return { view: 'manual', selectedJobId: null, selectedApplicationId: null, selectedRunId: null }
  }
  if (pathname === '/profile') {
    return { view: 'profile', selectedJobId: null, selectedApplicationId: null, selectedRunId: null }
  }
  if (pathname === '/runs') {
    return { view: 'runs', selectedJobId: null, selectedApplicationId: null, selectedRunId: null }
  }
  if (pathname.startsWith('/runs/')) {
    const id = pathname.slice('/runs/'.length)
    return { view: 'run-detail', selectedJobId: null, selectedApplicationId: null, selectedRunId: id || null }
  }
  if (pathname === '/settings') {
    return { view: 'settings', selectedJobId: null, selectedApplicationId: null, selectedRunId: null }
  }
  if (pathname.startsWith('/applications/')) {
    const id = pathname.slice('/applications/'.length)
    return { view: 'application-detail', selectedJobId: null, selectedApplicationId: id || null, selectedRunId: null }
  }
  return { view: 'dashboard', selectedJobId: null, selectedApplicationId: null, selectedRunId: null }
}

const navItems: Array<{ id: Extract<View, 'dashboard' | 'jobs' | 'manual' | 'profile' | 'runs' | 'settings'>; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Overview', icon: Workflow },
  { id: 'runs', label: 'Pipelines (Runs)', icon: PlayCircle },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'manual', label: 'Manual Queue', icon: ShieldAlert },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const titleByView: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: 'Overview', subtitle: 'Operational snapshot across runs, jobs, and manual interventions.' },
  jobs: { title: 'Jobs', subtitle: 'Track sourced opportunities and action them quickly.' },
  manual: { title: 'Manual Queue', subtitle: 'Resolve blocked automation sessions and resume execution.' },
  profile: { title: 'Profile', subtitle: 'Manage applicant identity, summary, and reusable context.' },
  runs: { title: 'Pipelines (Runs)', subtitle: 'Inspect pipeline status, filter aggressively, and drill into activity.' },
  settings: { title: 'Settings', subtitle: 'Configure LLM providers, ATS credentials, behavior, and schedules.' },
  'job-detail': { title: 'Job Detail', subtitle: 'Inspect a selected job and linked records.' },
  'application-detail': { title: 'Application Detail', subtitle: 'Inspect application outcomes and generated artifacts.' },
  'run-detail': { title: 'Run Detail', subtitle: 'Trace run events, metrics, and related work.' },
}

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem('huntarr.theme')
  return stored === 'dark' || stored === 'light' ? stored : 'system'
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = useMemo(() => resolveRoute(location.pathname), [location.pathname])
  const view = routeState.view
  const [runs, setRuns] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [jobsCounts, setJobsCounts] = useState({ total: 0, new: 0, queued: 0, applied: 0 })
  const [applications, setApplications] = useState<any[]>([])
  const [manualActions, setManualActions] = useState<any[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

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
      setJobs(jobsRes.items || [])
      setJobsCounts(jobsRes.counts || { total: 0, new: 0, queued: 0, applied: 0 })
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

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')

    if (themeMode === 'system') {
      window.localStorage.removeItem('huntarr.theme')
    } else {
      window.localStorage.setItem('huntarr.theme', themeMode)
    }
  }, [resolvedTheme, themeMode])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  const startHunt = async () => {
    setBusy(true)
    try {
      const search_config: Record<string, unknown> = {}

      if (profile?.desired_job_title) {
        search_config.role_keywords = [profile.desired_job_title]
      }

      if (profile?.desired_location) {
        search_config.locations = [profile.desired_location]
      }

      if (profile?.job_sources) {
        const enabledSources = Object.entries(profile.job_sources)
          .filter(([_, enabled]) => enabled)
          .map(([source]) => source)

        if (enabledSources.length > 0) {
          search_config.sources = enabledSources
        }
      }

      await api.createRun({ mode: 'manual', search_config })
      await refresh()
      navigate('/runs')
    } finally {
      setBusy(false)
    }
  }

  const onApplyNow = async (jobId: string) => {
    await api.applyNow(jobId)
    await refresh()
  }

  const onDeleteAll = async () => {
    try {
      await api.deleteJobs()
      await refresh()
    } catch (err: any) {
      setError(err.message ?? 'Failed to delete jobs')
    }
  }

  const onStartManual = async (id: string) => {
    await api.startManualSession(id)
    await refresh()
  }

  const onResolveManual = async (id: string) => {
    await api.resolveManualAction(id)
    await refresh()
  }

  const onPauseRun = async (id: string) => {
    await api.pauseRun(id)
    await refresh()
  }

  const onResumeRun = async (id: string) => {
    await api.resumeRun(id)
    await refresh()
  }

  const onViewJob = (jobId: string) => {
    navigate(`/jobs/${jobId}`)
  }

  const onViewApplication = (applicationId: string) => {
    navigate(`/applications/${applicationId}`)
  }

  const onBack = () => {
    navigate('/jobs')
  }

  const onBackToRuns = () => {
    navigate('/runs')
  }

  const onSelectRun = (runId: string) => {
    navigate(`/runs/${runId}`)
  }

  const navView: View = view === 'job-detail' || view === 'application-detail' ? 'jobs' : view === 'run-detail' ? 'runs' : view

  const titleMeta = titleByView[view]

  const openRunsSearch = () => {
    navigate('/runs')
    window.setTimeout(() => window.dispatchEvent(new Event('huntarr:focus-runs-search')), 0)
  }

  const ShellNav = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-5 dark:border-gray-800">
        <p className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">huntarr</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">control center</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = navView === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigate(routePathForView(item.id))
                if (mobile) setMobileNavOpen(false)
              }}
              className={[
                'group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
                active
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-100',
              ].join(' ')}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>Live control plane for runs, jobs, and manual actions.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen p-3 md:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-7xl gap-4 md:min-h-[calc(100vh-2.5rem)]">
        <aside className="hidden w-64 shrink-0 rounded-xl border border-gray-200 bg-white shadow-sm md:block dark:border-gray-800 dark:bg-gray-950/70">
          <ShellNav />
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button type="button" className="absolute inset-0 bg-black/55" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />
            <aside className="relative h-full w-[84%] max-w-xs rounded-r-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-950">
              <div className="absolute right-3 top-3">
                <IconButton title="Close menu" onClick={() => setMobileNavOpen(false)}>
                  <X size={18} />
                </IconButton>
              </div>
              <ShellNav mobile />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-3 z-20 rounded-xl border border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-sm md:px-6 dark:border-gray-800 dark:bg-gray-950/85">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="md:hidden">
                  <IconButton title="Open menu" onClick={() => setMobileNavOpen(true)}>
                    <Menu size={18} />
                  </IconButton>
                </div>
                {view === 'job-detail' || view === 'application-detail' || view === 'run-detail' ? (
                  <Button variant="ghost" className="hidden border border-gray-200 text-xs dark:border-gray-700 sm:inline-flex" onClick={view === 'run-detail' ? onBackToRuns : onBack}>
                    <ArrowLeft size={14} /> Back
                  </Button>
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 md:text-base dark:text-gray-100">{titleMeta.title}</p>
                  <p className="hidden truncate text-xs text-gray-600 md:block dark:text-gray-400">{titleMeta.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button variant="secondary" className="hidden text-xs md:inline-flex" onClick={openRunsSearch}>
                  <Search size={14} /> Quick Search
                </Button>
                <IconButton
                  title="Toggle theme"
                  onClick={() => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className="relative overflow-hidden"
                >
                  <Sun
                    size={16}
                    className={[
                      'absolute transition-all duration-150',
                      resolvedTheme === 'light' ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0',
                    ].join(' ')}
                  />
                  <Moon
                    size={16}
                    className={[
                      'absolute transition-all duration-150',
                      resolvedTheme === 'dark' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
                    ].join(' ')}
                  />
                </IconButton>
                {themeMode !== 'system' ? (
                  <Button variant="ghost" className="hidden border border-gray-200 text-xs dark:border-gray-700 lg:inline-flex" onClick={() => setThemeMode('system')}>
                    System
                  </Button>
                ) : null}
                <IconButton title="Refresh" onClick={refresh}>
                  <RefreshCw size={16} />
                </IconButton>
                <Button variant="attention" onClick={startHunt} disabled={busy} className="text-xs sm:text-sm">
                  Start Hunt
                </Button>
                <span className="hidden h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 sm:inline-flex">
                  HR
                </span>
              </div>
            </div>
          </header>

          <main className="motion-enter mt-4 flex-1 rounded-xl border border-gray-200 bg-white/80 p-4 shadow-sm md:p-6 dark:border-gray-800 dark:bg-gray-950/60">
            {error ? <Card className="mb-4 border-red-200 text-red-700 dark:border-red-900/50 dark:text-red-300" variant="muted">{error}</Card> : null}

            {view === 'dashboard' ? <DashboardPage runs={runs} jobs={jobs} manualActions={manualActions} applications={applications} /> : null}
            {view === 'jobs' ? <JobsPage jobs={jobs} counts={jobsCounts} onApplyNow={onApplyNow} onViewJob={onViewJob} onDeleteAll={onDeleteAll} /> : null}
            {view === 'manual' ? <ManualQueuePage actions={manualActions} onStart={onStartManual} onResolve={onResolveManual} /> : null}
            {view === 'profile' ? (
              <ProfilePage
                profile={profile}
                onSave={async (payload) => {
                  await api.saveProfile(payload)
                  await refresh()
                }}
              />
            ) : null}
            {view === 'runs' ? (
              <RunsPage
                runs={runs}
                jobs={jobs}
                applications={applications}
                manualActions={manualActions}
                onSelectRun={onSelectRun}
                onPauseRun={onPauseRun}
                onResumeRun={onResumeRun}
              />
            ) : null}
            {view === 'settings' ? <SettingsPage /> : null}
            {view === 'job-detail' && routeState.selectedJobId ? (
              <JobDetailPage jobId={routeState.selectedJobId} onBack={onBack} onViewApplication={onViewApplication} />
            ) : null}
            {view === 'application-detail' && routeState.selectedApplicationId ? (
              <ApplicationDetailPage applicationId={routeState.selectedApplicationId} onBack={onBack} />
            ) : null}
            {view === 'run-detail' && routeState.selectedRunId ? <RunDetailPage runId={routeState.selectedRunId} onBack={onBackToRuns} /> : null}
          </main>
        </div>
      </div>
    </div>
  )
}
