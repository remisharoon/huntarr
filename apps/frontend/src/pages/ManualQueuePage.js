import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Badge, Button, Card, FilterChip, PageHeader } from '../components/ui';
function deriveUrgency(action) {
    const source = `${action.action_type || ''} ${action.title || ''}`.toLowerCase();
    if (source.includes('captcha') || source.includes('challenge') || source.includes('blocked'))
        return 'high';
    if (source.includes('otp') || source.includes('verification'))
        return 'medium';
    return 'low';
}
export function ManualQueuePage({ actions, onStart, onResolve, }) {
    const [statusFilter, setStatusFilter] = useState('all');
    const filteredActions = useMemo(() => {
        return actions.filter((action) => {
            if (statusFilter === 'all')
                return true;
            return action.status === statusFilter;
        });
    }, [actions, statusFilter]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Manual Queue", subtitle: "Grouped operator actions with urgency cues and fast resolution controls.", actions: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FilterChip, { active: statusFilter === 'all', onClick: () => setStatusFilter('all'), children: "All" }), _jsx(FilterChip, { active: statusFilter === 'pending', onClick: () => setStatusFilter('pending'), children: "Pending" }), _jsx(FilterChip, { active: statusFilter === 'resolved', onClick: () => setStatusFilter('resolved'), children: "Resolved" })] }) }), _jsxs(Card, { className: "overflow-hidden p-0", children: [_jsxs("div", { className: "hidden grid-cols-[1.8fr_1.1fr_0.8fr_0.8fr_auto] gap-2 border-b border-border bg-elevated/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted md:grid", children: [_jsx("span", { children: "Queue Item" }), _jsx("span", { children: "Action Type" }), _jsx("span", { children: "Status" }), _jsx("span", { children: "Urgency" }), _jsx("span", { children: "Actions" })] }), filteredActions.length === 0 ? (_jsx("div", { className: "px-4 py-8 text-center text-sm text-muted", children: "No manual actions in this filter." })) : (_jsx("div", { className: "divide-y divide-border", children: filteredActions.map((action) => {
                            const urgency = deriveUrgency(action);
                            return (_jsxs("div", { className: "grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1.8fr_1.1fr_0.8fr_0.8fr_auto] md:items-center", children: [_jsxs("div", { children: [_jsxs("p", { className: "font-semibold text-text", children: [action.company || 'Unknown company', " - ", action.title || 'Untitled item'] }), _jsx("p", { className: "mt-1 text-xs text-muted", children: new Date(action.created_at).toLocaleString() }), action.session_url ? (_jsx("a", { className: "mt-1 inline-block text-xs text-accent hover:underline", href: action.session_url, target: "_blank", rel: "noreferrer", children: "Open noVNC session" })) : null] }), _jsx("p", { className: "text-sm text-muted", children: action.action_type || 'manual_step' }), _jsx("div", { children: _jsx(Badge, { tone: action.status === 'resolved' ? 'success' : action.status === 'pending' ? 'warning' : 'default', children: action.status || 'unknown' }) }), _jsx("div", { children: _jsx(Badge, { tone: urgency === 'high' ? 'danger' : urgency === 'medium' ? 'warning' : 'info', children: urgency }) }), _jsxs("div", { className: "flex flex-wrap justify-start gap-2 md:justify-end", children: [_jsx(Button, { variant: "secondary", className: "h-8 px-2 text-xs", onClick: () => onStart(action.id), children: "Start Session" }), _jsx(Button, { className: "h-8 px-2 text-xs", onClick: () => onResolve(action.id), children: "Resolve" })] })] }, action.id));
                        }) }))] })] }));
}
