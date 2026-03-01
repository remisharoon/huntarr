import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Card } from '../components/ui';
export function RunsPage({ runs, onSelectRun }) {
    const getStatusColor = (status) => {
        const colors = {
            queued: 'bg-muted text-white',
            running: 'bg-accent text-white',
            paused: 'bg-yellow-500 text-white',
            completed: 'bg-green-500 text-white',
            failed: 'bg-red-500 text-white',
        };
        return colors[status] || 'bg-muted text-white';
    };
    const calculateDuration = (run) => {
        if (!run.started_at)
            return '-';
        const start = new Date(run.started_at);
        const end = run.completed_at ? new Date(run.completed_at) : new Date();
        const diff = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
        return `${diff}m`;
    };
    const formatDate = (dateStr) => {
        if (!dateStr)
            return '-';
        return new Date(dateStr).toLocaleString();
    };
    return (_jsx("div", { className: "space-y-3", children: runs.map((run) => (_jsxs(Card, { className: "cursor-pointer hover:ring-2 hover:ring-accent transition-all", onClick: () => onSelectRun(run.id), children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("h3", { className: "font-display text-lg font-semibold", children: ["Run ", run.id.slice(0, 8)] }), _jsx("span", { className: `text-xs px-2 py-1 rounded-full ${getStatusColor(run.status)}`, children: run.status })] }), _jsxs("div", { className: "flex items-center gap-4 text-sm text-muted mb-2", children: [_jsx("span", { className: "capitalize", children: run.mode }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: run.current_node || 'N/A' }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: calculateDuration(run) })] }), _jsxs("div", { className: "flex items-center gap-4 text-sm", children: [_jsxs("span", { className: "text-accent font-semibold", children: [run.metrics.applied, " applied"] }), _jsxs("span", { className: "text-muted", children: [run.metrics.discovered ?? 0, " discovered"] }), run.metrics.failed > 0 && (_jsxs("span", { className: "text-red-500", children: [run.metrics.failed, " failed"] }))] })] }, run.id))) }));
}
