import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, PauseCircle, PlayCircle, RotateCcw, Wrench } from 'lucide-react';
import { Badge, Button, Card, IconButton, PageHeader, SegmentedControl } from '../components/ui';
import { cn } from '../lib/utils';
const statusSortOrder = {
    failed: 0,
    running: 1,
    paused: 2,
    queued: 3,
    completed: 4,
};
function getDurationSeconds(run) {
    if (!run.started_at)
        return 0;
    const start = new Date(run.started_at).getTime();
    const end = run.completed_at ? new Date(run.completed_at).getTime() : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
}
function formatDuration(seconds) {
    if (!seconds)
        return '-';
    if (seconds < 60)
        return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60)
        return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
}
function formatDate(dateValue) {
    if (!dateValue)
        return '-';
    return new Date(dateValue).toLocaleString();
}
function statusTone(status) {
    if (status === 'completed')
        return 'success';
    if (status === 'failed')
        return 'danger';
    if (status === 'running')
        return 'info';
    if (status === 'paused')
        return 'warning';
    return 'default';
}
export function RunsPage({ runs, jobs, applications, manualActions, onSelectRun, onPauseRun, onResumeRun }) {
    const [filters, setFilters] = useState({ status: 'all', mode: 'all', query: '', dateScope: 'all' });
    const [sortKey, setSortKey] = useState('started_at');
    const [sortDirection, setSortDirection] = useState('desc');
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [busyRunId, setBusyRunId] = useState(null);
    const [actionError, setActionError] = useState(null);
    const searchRef = useRef(null);
    useEffect(() => {
        const onFocusSearch = () => {
            searchRef.current?.focus();
            searchRef.current?.select();
        };
        window.addEventListener('huntarr:focus-runs-search', onFocusSearch);
        return () => window.removeEventListener('huntarr:focus-runs-search', onFocusSearch);
    }, []);
    const filteredAndSortedRuns = useMemo(() => {
        const now = Date.now();
        const filtered = runs.filter((run) => {
            if (filters.status !== 'all' && run.status !== filters.status)
                return false;
            if (filters.mode !== 'all' && run.mode !== filters.mode)
                return false;
            if (filters.dateScope !== 'all') {
                const scopeMs = filters.dateScope === '24h' ? 24 * 60 * 60 * 1000 : filters.dateScope === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
                const runDate = run.started_at ? new Date(run.started_at).getTime() : new Date(run.updated_at).getTime();
                if (now - runDate > scopeMs)
                    return false;
            }
            const normalized = filters.query.trim().toLowerCase();
            if (!normalized)
                return true;
            const queryBase = [run.id, run.mode, run.status, run.current_node || ''].join(' ').toLowerCase();
            return queryBase.includes(normalized);
        });
        const sorted = [...filtered].sort((a, b) => {
            let compare = 0;
            if (sortKey === 'started_at') {
                const aDate = a.started_at ? new Date(a.started_at).getTime() : new Date(a.updated_at).getTime();
                const bDate = b.started_at ? new Date(b.started_at).getTime() : new Date(b.updated_at).getTime();
                compare = aDate - bDate;
            }
            else if (sortKey === 'duration') {
                compare = getDurationSeconds(a) - getDurationSeconds(b);
            }
            else {
                compare = statusSortOrder[a.status] - statusSortOrder[b.status];
            }
            return sortDirection === 'asc' ? compare : compare * -1;
        });
        return sorted;
    }, [filters, runs, sortDirection, sortKey]);
    useEffect(() => {
        if (!filteredAndSortedRuns.length) {
            setFocusedIndex(-1);
            return;
        }
        if (focusedIndex >= filteredAndSortedRuns.length) {
            setFocusedIndex(filteredAndSortedRuns.length - 1);
        }
    }, [filteredAndSortedRuns, focusedIndex]);
    const toggleExpanded = (runId) => {
        setExpandedRows((previous) => {
            const next = new Set(previous);
            if (next.has(runId)) {
                next.delete(runId);
            }
            else {
                next.add(runId);
            }
            return next;
        });
    };
    const handleRunAction = async (runId, action) => {
        setBusyRunId(runId);
        setActionError(null);
        try {
            if (action === 'pause') {
                await Promise.resolve(onPauseRun(runId));
            }
            else {
                await Promise.resolve(onResumeRun(runId));
            }
        }
        catch (err) {
            setActionError(err?.message ?? 'Failed to execute run action');
        }
        finally {
            setBusyRunId(null);
        }
    };
    const onGridKeyDown = (event) => {
        const target = event.target;
        const isTypingTarget = target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target instanceof HTMLSelectElement ||
            !!target.closest('button');
        if (event.key.toLowerCase() === 'f' && !isTypingTarget) {
            event.preventDefault();
            searchRef.current?.focus();
            return;
        }
        if (!filteredAndSortedRuns.length || isTypingTarget)
            return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setFocusedIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, filteredAndSortedRuns.length - 1)));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setFocusedIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const run = filteredAndSortedRuns[focusedIndex];
            if (run) {
                toggleExpanded(run.id);
            }
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            setFocusedIndex(-1);
            setExpandedRows(new Set());
        }
    };
    return (_jsxs("div", { className: "space-y-4", tabIndex: 0, onKeyDown: onGridKeyDown, children: [_jsx(PageHeader, { title: "Pipelines (Runs)", subtitle: "Dense pipeline table with filtering, sort controls, and expandable run insight rows." }), _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "grid gap-2 md:grid-cols-4", children: [_jsx("input", { ref: searchRef, value: filters.query, onChange: (event) => setFilters({ ...filters, query: event.target.value }), placeholder: "Search by run id or current node", className: "w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]" }), _jsxs("select", { value: filters.status, onChange: (event) => setFilters({ ...filters, status: event.target.value }), className: "rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]", children: [_jsx("option", { value: "all", children: "All statuses" }), _jsx("option", { value: "queued", children: "Queued" }), _jsx("option", { value: "running", children: "Running" }), _jsx("option", { value: "paused", children: "Paused" }), _jsx("option", { value: "completed", children: "Completed" }), _jsx("option", { value: "failed", children: "Failed" })] }), _jsxs("select", { value: filters.mode, onChange: (event) => setFilters({ ...filters, mode: event.target.value }), className: "rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]", children: [_jsx("option", { value: "all", children: "All modes" }), _jsx("option", { value: "manual", children: "Manual" }), _jsx("option", { value: "scheduled", children: "Scheduled" })] }), _jsxs("select", { value: filters.dateScope, onChange: (event) => setFilters({ ...filters, dateScope: event.target.value }), className: "rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]", children: [_jsx("option", { value: "all", children: "All time" }), _jsx("option", { value: "24h", children: "Last 24 hours" }), _jsx("option", { value: "7d", children: "Last 7 days" }), _jsx("option", { value: "30d", children: "Last 30 days" })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(SegmentedControl, { value: sortKey, onChange: setSortKey, options: [
                                    { value: 'started_at', label: 'Sort: Start' },
                                    { value: 'duration', label: 'Sort: Duration' },
                                    { value: 'status', label: 'Sort: Status' },
                                ] }), _jsx(SegmentedControl, { value: sortDirection, onChange: setSortDirection, options: [
                                    { value: 'desc', label: 'Desc' },
                                    { value: 'asc', label: 'Asc' },
                                ] }), _jsxs(Badge, { tone: "default", children: [filteredAndSortedRuns.length, " rows"] }), _jsx("p", { className: "text-xs text-muted", children: "Use Up/Down + Enter, press f to focus search." })] }), actionError ? _jsx("p", { className: "text-sm text-danger", children: actionError }) : null] }), _jsxs(Card, { className: "overflow-hidden p-0", children: [_jsxs("div", { className: "hidden grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr_1fr_0.8fr_auto] gap-2 border-b border-border bg-elevated/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted md:grid", children: [_jsx("span", { children: "Pipeline" }), _jsx("span", { children: "Status" }), _jsx("span", { children: "Workflow/Mode" }), _jsx("span", { children: "Current Node" }), _jsx("span", { children: "Start" }), _jsx("span", { children: "Duration" }), _jsx("span", { children: "Actions" })] }), filteredAndSortedRuns.length === 0 ? (_jsx("div", { className: "px-4 py-8 text-center text-sm text-muted", children: "No runs match this filter combination." })) : (_jsx("div", { className: "divide-y divide-border", children: filteredAndSortedRuns.map((run, index) => {
                            const isExpanded = expandedRows.has(run.id);
                            const isFocused = focusedIndex === index;
                            const duration = getDurationSeconds(run);
                            const relatedApplications = applications.filter((application) => application.run_id === run.id);
                            const relatedManual = manualActions.filter((action) => action.run_id === run.id);
                            const relatedJobs = jobs.filter((job) => job.run_id === run.id || job.last_run_id === run.id);
                            return (_jsxs("div", { className: cn('transition', isFocused ? 'bg-accent/10' : 'bg-transparent'), children: [_jsxs("div", { className: "grid w-full grid-cols-1 gap-2 px-4 py-3 text-left md:grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr_1fr_0.8fr_auto] md:items-center", onClick: () => {
                                            setFocusedIndex(index);
                                            toggleExpanded(run.id);
                                        }, children: [_jsxs("div", { children: [_jsxs("p", { className: "font-semibold text-text", children: ["Run ", String(run.id).slice(0, 10)] }), _jsx("p", { className: "text-xs text-muted", children: run.error ? `Error: ${run.error}` : 'No run error' })] }), _jsx("div", { children: _jsx(Badge, { tone: statusTone(run.status), children: run.status }) }), _jsx("p", { className: "text-sm text-muted", children: run.mode }), _jsx("p", { className: "truncate text-sm text-muted", children: run.current_node || 'N/A' }), _jsx("p", { className: "text-sm text-muted", children: formatDate(run.started_at || run.updated_at) }), _jsx("p", { className: "text-sm text-muted", children: formatDuration(duration) }), _jsxs("div", { className: "flex items-center gap-1", onClick: (event) => event.stopPropagation(), children: [run.status === 'running' ? (_jsx(IconButton, { title: "Pause run", onClick: () => handleRunAction(run.id, 'pause'), disabled: busyRunId === run.id, children: _jsx(PauseCircle, { size: 15 }) })) : null, run.status === 'paused' ? (_jsx(IconButton, { title: "Resume run", onClick: () => handleRunAction(run.id, 'resume'), disabled: busyRunId === run.id, children: _jsx(PlayCircle, { size: 15 }) })) : null, _jsxs("button", { type: "button", title: "Coming soon", className: "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition hover:bg-elevated", children: [_jsx(RotateCcw, { size: 15 }), _jsx("span", { className: "sr-only", children: "Coming soon" })] }), _jsxs("button", { type: "button", title: "Coming soon", className: "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition hover:bg-elevated", children: [_jsx(Wrench, { size: 15 }), _jsx("span", { className: "sr-only", children: "Coming soon" })] }), _jsxs("button", { type: "button", title: "Coming soon", className: "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted transition hover:bg-elevated", children: [_jsx(MoreHorizontal, { size: 15 }), _jsx("span", { className: "sr-only", children: "Coming soon" })] })] })] }), _jsx("div", { className: cn('grid overflow-hidden px-4 transition-[grid-template-rows,opacity,margin] duration-200', isExpanded ? 'mb-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'), children: _jsxs("div", { className: "min-h-0 overflow-hidden rounded-xl border border-border bg-elevated/70 p-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.1em] text-muted", children: "Jobs" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-text", children: relatedJobs.length || run.metrics.discovered || 0 })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.1em] text-muted", children: "Applications" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-text", children: relatedApplications.length || run.metrics.applied })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.1em] text-muted", children: "Manual actions" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-text", children: relatedManual.length || run.metrics.manual_required })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs uppercase tracking-[0.1em] text-muted", children: "Failed" }), _jsx("p", { className: "mt-1 text-sm font-semibold text-text", children: run.metrics.failed })] })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [_jsx(Button, { variant: "secondary", className: "h-8 px-2 text-xs", onClick: () => onSelectRun(run.id), children: "Open Run Detail" }), _jsxs(Badge, { tone: "info", children: ["Updated: ", formatDate(run.updated_at)] })] })] }) })] }, run.id));
                        }) }))] })] }));
}
