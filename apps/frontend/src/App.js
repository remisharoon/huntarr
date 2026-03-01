import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, Command, Keyboard, Menu, Moon, PlayCircle, RefreshCw, Search, Settings, ShieldAlert, Sun, UserRound, Workflow, X, } from 'lucide-react';
import { Badge, Button, Card, IconButton, Kbd } from './components/ui';
import { api } from './lib/api';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { ManualQueuePage } from './pages/ManualQueuePage';
import { ProfilePage } from './pages/ProfilePage';
import { RunDetailPage } from './pages/RunDetailPage';
import { RunsPage } from './pages/RunsPage';
import { SettingsPage } from './pages/SettingsPage';
const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Workflow },
    { id: 'runs', label: 'Pipelines (Runs)', icon: PlayCircle },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'manual', label: 'Manual Queue', icon: ShieldAlert },
    { id: 'profile', label: 'Profile', icon: UserRound },
    { id: 'settings', label: 'Settings', icon: Settings },
];
const titleByView = {
    dashboard: { title: 'Overview', subtitle: 'Operational snapshot across runs, jobs, and manual interventions.' },
    jobs: { title: 'Jobs', subtitle: 'Track sourced opportunities and action them quickly.' },
    manual: { title: 'Manual Queue', subtitle: 'Resolve blocked automation sessions and resume execution.' },
    profile: { title: 'Profile', subtitle: 'Manage applicant identity, summary, and reusable context.' },
    runs: { title: 'Pipelines (Runs)', subtitle: 'Inspect pipeline status, filter aggressively, and drill into activity.' },
    settings: { title: 'Settings', subtitle: 'Configure LLM providers, ATS credentials, behavior, and schedules.' },
    'job-detail': { title: 'Job Detail', subtitle: 'Inspect a selected job and linked records.' },
    'application-detail': { title: 'Application Detail', subtitle: 'Inspect application outcomes and generated artifacts.' },
    'run-detail': { title: 'Run Detail', subtitle: 'Trace run events, metrics, and related work.' },
};
function getStoredTheme() {
    if (typeof window === 'undefined')
        return 'system';
    const stored = window.localStorage.getItem('huntarr.theme');
    return stored === 'dark' || stored === 'light' ? stored : 'system';
}
export default function App() {
    const [view, setView] = useState('dashboard');
    const [runs, setRuns] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [manualActions, setManualActions] = useState([]);
    const [profile, setProfile] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [selectedJobId, setSelectedJobId] = useState(null);
    const [selectedApplicationId, setSelectedApplicationId] = useState(null);
    const [selectedRunId, setSelectedRunId] = useState(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [themeMode, setThemeMode] = useState(getStoredTheme);
    const [systemTheme, setSystemTheme] = useState(() => {
        if (typeof window === 'undefined')
            return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });
    const goPrefixActive = useRef(false);
    const goPrefixTimer = useRef(null);
    const refresh = async () => {
        try {
            setError(null);
            const [runsRes, jobsRes, appRes, manualRes, profileRes] = await Promise.all([
                api.listRuns(),
                api.listJobs(),
                api.listApplications(),
                api.listManualActions(),
                api.getProfile(),
            ]);
            setRuns(runsRes.items);
            setJobs(jobsRes.items);
            setApplications(appRes.items);
            setManualActions(manualRes.items);
            setProfile(profileRes);
        }
        catch (err) {
            setError(err.message ?? 'Failed to load data');
        }
    };
    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, 8000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);
    const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode;
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-dark', 'theme-light');
        root.classList.add(resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light');
        if (themeMode === 'system') {
            window.localStorage.removeItem('huntarr.theme');
        }
        else {
            window.localStorage.setItem('huntarr.theme', themeMode);
        }
    }, [resolvedTheme, themeMode]);
    useEffect(() => {
        const onKeyDown = (event) => {
            const target = event.target;
            const isTypingTarget = target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                !!target?.closest('[contenteditable=true]');
            if (event.key === '?' && !isTypingTarget) {
                event.preventDefault();
                setShowShortcuts((prev) => !prev);
                return;
            }
            if (isTypingTarget)
                return;
            const key = event.key.toLowerCase();
            if (goPrefixActive.current) {
                goPrefixActive.current = false;
                if (goPrefixTimer.current) {
                    window.clearTimeout(goPrefixTimer.current);
                    goPrefixTimer.current = null;
                }
                if (key === 'r') {
                    setView('runs');
                    return;
                }
                if (key === 'j') {
                    setView('jobs');
                    return;
                }
                if (key === 'd') {
                    setView('dashboard');
                    return;
                }
            }
            if (key === 'g') {
                goPrefixActive.current = true;
                if (goPrefixTimer.current)
                    window.clearTimeout(goPrefixTimer.current);
                goPrefixTimer.current = window.setTimeout(() => {
                    goPrefixActive.current = false;
                    goPrefixTimer.current = null;
                }, 1000);
                return;
            }
            if (key === 'f' && view === 'runs') {
                window.dispatchEvent(new Event('huntarr:focus-runs-search'));
            }
            if (key === '/') {
                event.preventDefault();
                setView('runs');
                window.setTimeout(() => window.dispatchEvent(new Event('huntarr:focus-runs-search')), 0);
            }
            if (key === 'escape') {
                setMobileNavOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            if (goPrefixTimer.current)
                window.clearTimeout(goPrefixTimer.current);
        };
    }, [view]);
    const latestRunId = useMemo(() => (runs[0]?.id ? String(runs[0].id) : null), [runs]);
    const startHunt = async () => {
        setBusy(true);
        try {
            await api.createRun({ mode: 'manual', search_config: {} });
            await refresh();
            setView('runs');
        }
        finally {
            setBusy(false);
        }
    };
    const onApplyNow = async (jobId) => {
        await api.applyNow(jobId);
        await refresh();
    };
    const onStartManual = async (id) => {
        await api.startManualSession(id);
        await refresh();
    };
    const onResolveManual = async (id) => {
        await api.resolveManualAction(id);
        await refresh();
    };
    const onPauseRun = async (id) => {
        await api.pauseRun(id);
        await refresh();
    };
    const onResumeRun = async (id) => {
        await api.resumeRun(id);
        await refresh();
    };
    const onViewJob = (jobId) => {
        setSelectedJobId(jobId);
        setView('job-detail');
    };
    const onViewApplication = (applicationId) => {
        setSelectedApplicationId(applicationId);
        setView('application-detail');
    };
    const onBack = () => {
        setSelectedJobId(null);
        setSelectedApplicationId(null);
        setSelectedRunId(null);
        setView('jobs');
    };
    const onBackToRuns = () => {
        setSelectedRunId(null);
        setView('runs');
    };
    const onSelectRun = (runId) => {
        setSelectedRunId(runId);
        setView('run-detail');
    };
    const navView = view === 'job-detail' || view === 'application-detail' ? 'jobs' : view === 'run-detail' ? 'runs' : view;
    const titleMeta = titleByView[view];
    const openRunsSearch = () => {
        setView('runs');
        window.setTimeout(() => window.dispatchEvent(new Event('huntarr:focus-runs-search')), 0);
    };
    const ShellNav = ({ mobile = false }) => (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "border-b border-border px-4 py-5", children: [_jsx("p", { className: "font-display text-2xl text-text", children: "huntarr" }), _jsx("p", { className: "mt-1 text-xs uppercase tracking-[0.2em] text-muted", children: "control center" })] }), _jsx("nav", { className: "flex-1 space-y-1 px-3 py-4", children: navItems.map((item) => {
                    const Icon = item.icon;
                    const active = navView === item.id;
                    return (_jsxs("button", { type: "button", onClick: () => {
                            setView(item.id);
                            if (mobile)
                                setMobileNavOpen(false);
                        }, className: [
                            'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-app',
                            active
                                ? 'border-accent/45 bg-accent/15 text-accent'
                                : 'border-transparent text-muted hover:border-border hover:bg-elevated hover:text-text',
                        ].join(' '), children: [_jsx(Icon, { size: 17 }), _jsx("span", { children: item.label })] }, item.id));
                }) }), _jsx("div", { className: "space-y-2 border-t border-border p-3 text-xs text-muted", children: _jsxs("div", { className: "rounded-lg border border-border bg-elevated/60 p-2.5", children: [_jsx("p", { className: "font-semibold text-text", children: "Shortcuts" }), _jsxs("p", { className: "mt-1", children: [_jsx(Kbd, { children: "g" }), " + ", _jsx(Kbd, { children: "r" }), " pipelines"] }), _jsxs("p", { className: "mt-1", children: [_jsx(Kbd, { children: "?" }), " full map"] })] }) })] }));
    return (_jsxs("div", { className: "app-frame text-text", children: [_jsxs("div", { className: "app-shell", children: [_jsx("aside", { className: "app-rail motion-sidebar hidden w-72 shrink-0 md:block", children: _jsx(ShellNav, {}) }), mobileNavOpen ? (_jsxs("div", { className: "fixed inset-0 z-50 md:hidden", children: [_jsx("button", { type: "button", className: "absolute inset-0 bg-black/55", onClick: () => setMobileNavOpen(false), "aria-label": "Close navigation overlay" }), _jsxs("aside", { className: "motion-sidebar relative h-full w-[84%] max-w-xs rounded-r-2xl border border-[var(--shell-border-strong)] bg-surface", children: [_jsx("div", { className: "absolute right-3 top-3", children: _jsx(IconButton, { title: "Close menu", onClick: () => setMobileNavOpen(false), children: _jsx(X, { size: 18 }) }) }), _jsx(ShellNav, { mobile: true })] })] })) : null, _jsxs("div", { className: "app-content-surface", children: [_jsx("header", { className: "sticky top-[var(--shell-gap)] z-20 mx-3 mt-3 rounded-2xl border border-border bg-app/95 px-5 py-3 backdrop-blur md:mx-4 md:px-7", children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [_jsx("div", { className: "md:hidden", children: _jsx(IconButton, { title: "Open menu", onClick: () => setMobileNavOpen(true), children: _jsx(Menu, { size: 18 }) }) }), view === 'job-detail' || view === 'application-detail' || view === 'run-detail' ? (_jsxs(Button, { variant: "ghost", className: "hidden border border-border text-xs sm:inline-flex", onClick: view === 'run-detail' ? onBackToRuns : onBack, children: [_jsx(ArrowLeft, { size: 14 }), " Back"] })) : null, _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-semibold text-text md:text-base", children: titleMeta.title }), _jsx("p", { className: "hidden truncate text-xs text-muted md:block", children: titleMeta.subtitle })] })] }), _jsxs("div", { className: "flex items-center gap-1.5 sm:gap-2", children: [_jsxs(Button, { variant: "secondary", className: "hidden text-xs md:inline-flex", onClick: openRunsSearch, children: [_jsx(Search, { size: 14 }), " Quick Search ", _jsx(Kbd, { children: "/" })] }), _jsxs(IconButton, { title: "Toggle theme", onClick: () => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark'), className: "relative overflow-hidden", children: [_jsx(Sun, { size: 16, className: [
                                                                'absolute transition-all duration-150',
                                                                resolvedTheme === 'light' ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0',
                                                            ].join(' ') }), _jsx(Moon, { size: 16, className: [
                                                                'absolute transition-all duration-150',
                                                                resolvedTheme === 'dark' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
                                                            ].join(' ') })] }), themeMode !== 'system' ? (_jsx(Button, { variant: "ghost", className: "hidden border border-border text-xs lg:inline-flex", onClick: () => setThemeMode('system'), children: "System" })) : null, _jsx(IconButton, { title: "Show keyboard shortcuts", onClick: () => setShowShortcuts(true), children: _jsx(Keyboard, { size: 16 }) }), _jsx(IconButton, { title: "Refresh", onClick: refresh, children: _jsx(RefreshCw, { size: 16 }) }), _jsx(Button, { onClick: startHunt, disabled: busy, className: "text-xs sm:text-sm", children: "Start Hunt" }), _jsx("span", { className: "hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-muted sm:inline-flex", children: "HR" })] })] }) }), _jsx("main", { className: "flex-1 px-3 pb-3 pt-[var(--shell-gap)] md:px-4 md:pb-4", children: _jsxs("div", { className: "motion-enter rounded-[calc(var(--shell-radius)-8px)] border border-border bg-surface/95 p-4 shadow-panel md:p-6", children: [_jsxs("div", { className: "mb-4 flex flex-wrap items-center gap-2", children: [latestRunId ? _jsxs(Badge, { tone: "info", children: ["Latest run ", latestRunId.slice(0, 10)] }) : null, _jsxs(Badge, { tone: "default", children: ["Theme: ", themeMode === 'system' ? `system (${resolvedTheme})` : themeMode] }), _jsx(Badge, { tone: "success", children: "Auto refresh 8s" })] }), error ? _jsx(Card, { className: "mb-4 border-danger text-danger", variant: "muted", children: error }) : null, view === 'dashboard' ? _jsx(DashboardPage, { runs: runs, jobs: jobs, manualActions: manualActions, applications: applications }) : null, view === 'jobs' ? _jsx(JobsPage, { jobs: jobs, onApplyNow: onApplyNow, onViewJob: onViewJob }) : null, view === 'manual' ? _jsx(ManualQueuePage, { actions: manualActions, onStart: onStartManual, onResolve: onResolveManual }) : null, view === 'profile' ? _jsx(ProfilePage, { profile: profile, onSave: async (payload) => { await api.saveProfile(payload); await refresh(); } }) : null, view === 'runs' ? (_jsx(RunsPage, { runs: runs, jobs: jobs, applications: applications, manualActions: manualActions, onSelectRun: onSelectRun, onPauseRun: onPauseRun, onResumeRun: onResumeRun })) : null, view === 'settings' ? _jsx(SettingsPage, {}) : null, view === 'job-detail' && selectedJobId ? (_jsx(JobDetailPage, { jobId: selectedJobId, onBack: onBack, onViewApplication: onViewApplication })) : null, view === 'application-detail' && selectedApplicationId ? (_jsx(ApplicationDetailPage, { applicationId: selectedApplicationId, onBack: onBack })) : null, view === 'run-detail' && selectedRunId ? _jsx(RunDetailPage, { runId: selectedRunId, onBack: onBackToRuns }) : null] }) })] })] }), showShortcuts ? (_jsx("div", { className: "fixed inset-0 z-50 grid place-items-center bg-black/55 p-4", children: _jsxs(Card, { className: "w-full max-w-xl border-border bg-surface p-5", variant: "panel", children: [_jsxs("div", { className: "mb-4 flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Keyboard Shortcuts" }), _jsx(IconButton, { title: "Close shortcuts", onClick: () => setShowShortcuts(false), children: _jsx(X, { size: 16 }) })] }), _jsxs("div", { className: "space-y-2 text-sm text-muted", children: [_jsxs("p", { children: [_jsx(Kbd, { children: "g" }), " then ", _jsx(Kbd, { children: "r" }), ": go to Pipelines (Runs)"] }), _jsxs("p", { children: [_jsx(Kbd, { children: "g" }), " then ", _jsx(Kbd, { children: "j" }), ": go to Jobs"] }), _jsxs("p", { children: [_jsx(Kbd, { children: "g" }), " then ", _jsx(Kbd, { children: "d" }), ": go to Overview"] }), _jsxs("p", { children: [_jsx(Kbd, { children: "f" }), ": focus run search (from Runs page)"] }), _jsxs("p", { children: [_jsx(Kbd, { children: "/" }), ": jump to runs search"] }), _jsxs("p", { children: [_jsx(Kbd, { children: "?" }), ": open/close shortcuts dialog"] }), _jsxs("p", { children: [_jsx(Kbd, { children: "Esc" }), ": close overlays and run row focus"] })] }), _jsx("div", { className: "mt-5 flex justify-end", children: _jsxs(Button, { variant: "secondary", onClick: () => setShowShortcuts(false), children: [_jsx(Command, { size: 14 }), " Close"] }) })] }) })) : null] }));
}
