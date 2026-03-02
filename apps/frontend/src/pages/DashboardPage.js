import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Badge, Card, PageHeader } from '../components/ui';
export function DashboardPage({ runs, jobs, manualActions, applications }) {
    const stats = useMemo(() => [
        {
            label: 'Pipelines (Runs)',
            value: runs.length,
            helper: `${runs.filter((run) => run.status === 'running').length} running`,
        },
        {
            label: 'Tracked Jobs',
            value: jobs.length,
            helper: `${jobs.filter((job) => (job.score ?? 0) >= 0.7).length} high confidence`,
        },
        {
            label: 'Applications',
            value: applications.length,
            helper: `${applications.filter((app) => app.status === 'submitted').length} submitted`,
        },
        {
            label: 'Manual Queue',
            value: manualActions.filter((item) => item.status !== 'resolved').length,
            helper: `${manualActions.filter((item) => item.status === 'pending').length} pending`,
        },
    ], [runs, jobs, manualActions, applications]);
    const latestRuns = useMemo(() => runs.slice(0, 6), [runs]);
    const unresolvedActions = useMemo(() => manualActions.filter((action) => action.status !== 'resolved').slice(0, 6), [manualActions]);
    return (_jsxs("div", { className: "space-y-5", children: [_jsx(PageHeader, { title: "Operational Overview", subtitle: "A dense view of throughput, queue pressure, and most recent pipeline activity." }), _jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: stats.map((item) => (_jsxs(Card, { variant: "muted", className: "p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.12em] text-muted", children: item.label }), _jsx("p", { className: "mt-2 font-display text-3xl text-text", children: item.value }), _jsx("p", { className: "mt-1 text-xs text-muted", children: item.helper })] }, item.label))) }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-2", children: [_jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Recent Pipelines" }), _jsxs(Badge, { tone: "info", children: [latestRuns.length, " showing"] })] }), latestRuns.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No runs yet." })) : (_jsx("div", { className: "space-y-2", children: latestRuns.map((run) => (_jsxs("div", { className: "grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-border bg-elevated/60 px-3 py-2 text-sm", children: [_jsxs("p", { className: "truncate font-semibold text-text", children: ["Run ", String(run.id).slice(0, 10)] }), _jsx(Badge, { tone: run.status === 'completed'
                                                ? 'success'
                                                : run.status === 'failed'
                                                    ? 'danger'
                                                    : run.status === 'running'
                                                        ? 'info'
                                                        : run.status === 'paused'
                                                            ? 'warning'
                                                            : 'default', children: run.status }), _jsx("p", { className: "text-xs text-muted", children: run.current_node || 'N/A' })] }, run.id))) }))] }), _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Manual Intervention Pressure" }), _jsx(Badge, { tone: unresolvedActions.length > 0 ? 'warning' : 'success', children: unresolvedActions.length > 0 ? 'Needs attention' : 'Healthy' })] }), unresolvedActions.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No unresolved manual actions." })) : (_jsx("div", { className: "space-y-2", children: unresolvedActions.map((action) => (_jsxs("div", { className: "rounded-xl border border-border bg-elevated/60 px-3 py-2", children: [_jsxs("p", { className: "text-sm font-semibold text-text", children: [action.company || 'Unknown company', " - ", action.title || 'Untitled action'] }), _jsxs("p", { className: "mt-1 text-xs text-muted", children: [action.action_type || 'manual_step', " - ", action.status] })] }, action.id))) }))] })] })] }));
}
