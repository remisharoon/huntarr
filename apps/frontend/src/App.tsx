import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Briefcase,
  Command,
  Keyboard,
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

import { Badge, Button, Card, IconButton, Kbd } from './components/ui'
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
import type { ThemeMode } from './types'

type View = 'dashboard' | 'jobs' | 'manual' | 'profile' | 'runs' | 'settings' | 'job-detail' | 'application-detail' | 'run-detail'

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
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const goPrefixActive = useRef(false)
  const goPrefixTimer = useRef<number | null>(null)

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

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light')

    if (themeMode === 'system') {
      window.localStorage.removeItem('huntarr.theme')
    } else {
      window.localStorage.setItem('huntarr.theme', themeMode)
    }
  }, [resolvedTheme, themeMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        !!target?.closest('[contenteditable=true]')

      if (event.key === '?' && !isTypingTarget) {
        event.preventDefault()
        setShowShortcuts((prev) => !prev)
        return
      }

      if (isTypingTarget) return

      const key = event.key.toLowerCase()

      if (goPrefixActive.current) {
        goPrefixActive.current = false
        if (goPrefixTimer.current) {
          window.clearTimeout(goPrefixTimer.current)
          goPrefixTimer.current = null
        }

        if (key === 'r') {
          setView('runs')
          return
        }
        if (key === 'j') {
          setView('jobs')
          return
        }
        if (key === 'd') {
          setView('dashboard')
          return
        }
      }

      if (key === 'g') {
        goPrefixActive.current = true
        if (goPrefixTimer.current) window.clearTimeout(goPrefixTimer.current)
        goPrefixTimer.current = window.setTimeout(() => {
          goPrefixActive.current = false
          goPrefixTimer.current = null
        }, 1000)
        return
      }

      if (key === 'f' && view === 'runs') {
        window.dispatchEvent(new Event('huntarr:focus-runs-search'))
      }

      if (key === '/') {
        event.preventDefault()
        setView('runs')
        window.setTimeout(() => window.dispatchEvent(new Event('huntarr:focus-runs-search')), 0)
      }

      if (key === 'escape') {
        setMobileNavOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (goPrefixTimer.current) window.clearTimeout(goPrefixTimer.current)
    }
  }, [view])

  const latestRunId = useMemo(() => (runs[0]?.id ? String(runs[0].id) : null), [runs])

  const startHunt = async () => {
    setBusy(true)
    try {
      await api.createRun({ mode: 'manual', search_config: {} })
      await refresh()
      setView('runs')
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

  const onPauseRun = async (id: string) => {
    await api.pauseRun(id)
    await refresh()
  }

  const onResumeRun = async (id: string) => {
    await api.resumeRun(id)
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
    setSelectedRunId(null)
    setView('jobs')
  }

  const onBackToRuns = () => {
    setSelectedRunId(null)
    setView('runs')
  }

  const onSelectRun = (runId: string) => {
    setSelectedRunId(runId)
    setView('run-detail')
  }

  const navView: View = view === 'job-detail' || view === 'application-detail' ? 'jobs' : view === 'run-detail' ? 'runs' : view

  const titleMeta = titleByView[view]

  const openRunsSearch = () => {
    setView('runs')
    window.setTimeout(() => window.dispatchEvent(new Event('huntarr:focus-runs-search')), 0)
  }

  const ShellNav = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-5">
        <p className="font-display text-2xl text-text">huntarr</p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">control center</p>
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
                setView(item.id)
                if (mobile) setMobileNavOpen(false)
              }}
              className={[
                'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app',
                active
                  ? 'border-accent/45 bg-accent/15 text-accent'
                  : 'border-transparent text-muted hover:border-border hover:bg-elevated hover:text-text',
              ].join(' ')}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="space-y-2 border-t border-border p-3 text-xs text-muted">
        <div className="rounded-lg border border-border bg-elevated/60 p-2.5">
          <p className="font-semibold text-text">Shortcuts</p>
          <p className="mt-1">
            <Kbd>g</Kbd> + <Kbd>r</Kbd> pipelines
          </p>
          <p className="mt-1">
            <Kbd>?</Kbd> full map
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-frame text-text">
      <div className="app-shell">
        <aside className="app-rail motion-sidebar hidden w-72 shrink-0 md:block">
          <ShellNav />
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button type="button" className="absolute inset-0 bg-black/55" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />
            <aside className="motion-sidebar relative h-full w-[84%] max-w-xs rounded-r-2xl border border-[var(--shell-border-strong)] bg-surface">
              <div className="absolute right-3 top-3">
                <IconButton title="Close menu" onClick={() => setMobileNavOpen(false)}>
                  <X size={18} />
                </IconButton>
              </div>
              <ShellNav mobile />
            </aside>
          </div>
        ) : null}

        <div className="app-content-surface">
          <header className="sticky top-[var(--shell-gap)] z-20 mx-3 mt-3 rounded-2xl border border-border bg-app/95 px-5 py-3 backdrop-blur md:mx-4 md:px-7">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="md:hidden">
                  <IconButton title="Open menu" onClick={() => setMobileNavOpen(true)}>
                    <Menu size={18} />
                  </IconButton>
                </div>
                {view === 'job-detail' || view === 'application-detail' || view === 'run-detail' ? (
                  <Button variant="ghost" className="hidden border border-border text-xs sm:inline-flex" onClick={view === 'run-detail' ? onBackToRuns : onBack}>
                    <ArrowLeft size={14} /> Back
                  </Button>
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text md:text-base">{titleMeta.title}</p>
                  <p className="hidden truncate text-xs text-muted md:block">{titleMeta.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button variant="secondary" className="hidden text-xs md:inline-flex" onClick={openRunsSearch}>
                  <Search size={14} /> Quick Search <Kbd>/</Kbd>
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
                  <Button variant="ghost" className="hidden border border-border text-xs lg:inline-flex" onClick={() => setThemeMode('system')}>
                    System
                  </Button>
                ) : null}
                <IconButton title="Show keyboard shortcuts" onClick={() => setShowShortcuts(true)}>
                  <Keyboard size={16} />
                </IconButton>
                <IconButton title="Refresh" onClick={refresh}>
                  <RefreshCw size={16} />
                </IconButton>
                <Button onClick={startHunt} disabled={busy} className="text-xs sm:text-sm">
                  Start Hunt
                </Button>
                <span className="hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-muted sm:inline-flex">
                  HR
                </span>
              </div>
            </div>
          </header>

          <main className="flex-1 px-3 pb-3 pt-[var(--shell-gap)] md:px-4 md:pb-4">
            <div className="motion-enter rounded-[calc(var(--shell-radius)-8px)] border border-border bg-surface/95 p-4 shadow-panel md:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {latestRunId ? <Badge tone="info">Latest run {latestRunId.slice(0, 10)}</Badge> : null}
                <Badge tone="default">Theme: {themeMode === 'system' ? `system (${resolvedTheme})` : themeMode}</Badge>
                <Badge tone="success">Auto refresh 8s</Badge>
              </div>

              {error ? <Card className="mb-4 border-danger text-danger" variant="muted">{error}</Card> : null}

              {view === 'dashboard' ? <DashboardPage runs={runs} jobs={jobs} manualActions={manualActions} applications={applications} /> : null}
              {view === 'jobs' ? <JobsPage jobs={jobs} onApplyNow={onApplyNow} onViewJob={onViewJob} /> : null}
              {view === 'manual' ? <ManualQueuePage actions={manualActions} onStart={onStartManual} onResolve={onResolveManual} /> : null}
              {view === 'profile' ? <ProfilePage profile={profile} onSave={async (payload) => { await api.saveProfile(payload); await refresh() }} /> : null}
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
              {view === 'job-detail' && selectedJobId ? (
                <JobDetailPage jobId={selectedJobId} onBack={onBack} onViewApplication={onViewApplication} />
              ) : null}
              {view === 'application-detail' && selectedApplicationId ? (
                <ApplicationDetailPage applicationId={selectedApplicationId} onBack={onBack} />
              ) : null}
              {view === 'run-detail' && selectedRunId ? <RunDetailPage runId={selectedRunId} onBack={onBackToRuns} /> : null}
            </div>
          </main>
        </div>
      </div>

      {showShortcuts ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <Card className="w-full max-w-xl border-border bg-surface p-5" variant="panel">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-text">Keyboard Shortcuts</h2>
              <IconButton title="Close shortcuts" onClick={() => setShowShortcuts(false)}>
                <X size={16} />
              </IconButton>
            </div>
            <div className="space-y-2 text-sm text-muted">
              <p>
                <Kbd>g</Kbd> then <Kbd>r</Kbd>: go to Pipelines (Runs)
              </p>
              <p>
                <Kbd>g</Kbd> then <Kbd>j</Kbd>: go to Jobs
              </p>
              <p>
                <Kbd>g</Kbd> then <Kbd>d</Kbd>: go to Overview
              </p>
              <p>
                <Kbd>f</Kbd>: focus run search (from Runs page)
              </p>
              <p>
                <Kbd>/</Kbd>: jump to runs search
              </p>
              <p>
                <Kbd>?</Kbd>: open/close shortcuts dialog
              </p>
              <p>
                <Kbd>Esc</Kbd>: close overlays and run row focus
              </p>
            </div>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={() => setShowShortcuts(false)}>
                <Command size={14} /> Close
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
