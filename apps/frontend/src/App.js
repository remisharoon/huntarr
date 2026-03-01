import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Briefcase, PlayCircle, Settings, ShieldAlert, UserRound, Workflow } from 'lucide-react';
import { Button, Card } from './components/ui';
import { api } from './lib/api';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';
import { ManualQueuePage } from './pages/ManualQueuePage';
import { ProfilePage } from './pages/ProfilePage';
import { RunsPage } from './pages/RunsPage';
import { SettingsPage } from './pages/SettingsPage';
const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Workflow },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'manual', label: 'Manual Queue', icon: ShieldAlert },
    { id: 'profile', label: 'Profile', icon: UserRound },
    { id: 'runs', label: 'Runs', icon: PlayCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
];
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
    const latestRunId = useMemo(() => (runs[0]?.id ? String(runs[0].id) : null), [runs]);
    const startHunt = async () => {
        setBusy(true);
        try {
            await api.createRun({ mode: 'manual', search_config: {} });
            await refresh();
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
        setView('jobs');
    };
    return (_jsxs("div", { className: "mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8", children: [_jsxs("header", { className: "mb-6 flex flex-col gap-4 rounded-3xl bg-ink p-6 text-white shadow-card md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-display text-3xl", children: "huntarr" }), _jsx("p", { className: "text-sm text-white/80", children: "Automated job research and application command center" }), latestRunId ? _jsxs("p", { className: "mt-2 text-xs text-white/70", children: ["Latest run: ", latestRunId] }) : null] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { onClick: refresh, variant: "ghost", className: "border border-white/30 text-white hover:bg-white/10", children: "Refresh" }), _jsx(Button, { onClick: startHunt, disabled: busy, className: "bg-accent text-white", children: "Start Hunt" })] })] }), error ? _jsx(Card, { className: "mb-4 border-red-200 text-red-700", children: error }) : null, _jsx("nav", { className: "mb-5 flex flex-wrap gap-2", children: tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (_jsx(Button, { variant: view === tab.id ? 'secondary' : 'ghost', className: view === tab.id ? '' : 'border border-black/10', onClick: () => setView(tab.id), children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Icon, { size: 16 }), tab.label] }) }, tab.id));
                }) }), view === 'dashboard' ? _jsx(DashboardPage, { runs: runs, jobs: jobs, manualActions: manualActions, applications: applications }) : null, view === 'jobs' ? _jsx(JobsPage, { jobs: jobs, onApplyNow: onApplyNow, onViewJob: onViewJob }) : null, view === 'manual' ? _jsx(ManualQueuePage, { actions: manualActions, onStart: onStartManual, onResolve: onResolveManual }) : null, view === 'profile' ? _jsx(ProfilePage, { profile: profile, onSave: async (payload) => { await api.saveProfile(payload); await refresh(); } }) : null, view === 'runs' ? _jsx(RunsPage, { runs: runs }) : null, view === 'settings' ? _jsx(SettingsPage, {}) : null, view === 'job-detail' && selectedJobId ? (_jsx(JobDetailPage, { jobId: selectedJobId, onBack: onBack, onViewApplication: onViewApplication })) : null, view === 'application-detail' && selectedApplicationId ? (_jsx(ApplicationDetailPage, { applicationId: selectedApplicationId, onBack: onBack })) : null] }));
}
