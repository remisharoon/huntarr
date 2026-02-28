import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Card } from '../components/ui';
export function DashboardPage({ runs, jobs, manualActions, applications }) {
    const stats = useMemo(() => [
        { label: 'Runs', value: runs.length },
        { label: 'Tracked Jobs', value: jobs.length },
        { label: 'Applications', value: applications.length },
        { label: 'Manual Queue', value: manualActions.filter((m) => m.status !== 'resolved').length },
    ], [runs, jobs, manualActions, applications]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4", children: stats.map((item) => (_jsxs(Card, { className: "p-5", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-muted", children: item.label }), _jsx("p", { className: "mt-2 text-3xl font-bold font-display", children: item.value })] }, item.label))) }), _jsxs(Card, { children: [_jsx("h2", { className: "font-display text-xl", children: "System posture" }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "Huntarr is configured for aggressive public discovery, auto-submit mode, and manual noVNC intervention queue on challenge detection." })] })] }));
}
