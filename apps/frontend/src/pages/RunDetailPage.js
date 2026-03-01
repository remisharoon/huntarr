import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertCircle, ArrowLeft, Copy, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, subscribeToRunEvents } from '../lib/api';
import { Button, Card } from '../components/ui';
export function RunDetailPage({ runId, onBack }) {
    const [run, setRun] = useState(null);
    const [events, setEvents] = useState([]);
    const [applications, setApplications] = useState([]);
    const [manualActions, setManualActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [eventFilters, setEventFilters] = useState({
        level: 'all',
    });
    const [autoScroll, setAutoScroll] = useState(true);
    const [copied, setCopied] = useState(false);
    const eventsEndRef = useRef(null);
    useEffect(() => {
        const loadData = async () => {
            try {
                setError(null);
                const [runData, eventsData, appsData, actionsData] = await Promise.all([
                    api.getRun(runId),
                    api.getRunEvents(runId, 50, 0),
                    api.getRunApplications(runId),
                    api.getRunManualActions(runId),
                ]);
                setRun(runData);
                setEvents(eventsData);
                setApplications(appsData.items);
                setManualActions(actionsData.items);
                setLoading(false);
            }
            catch (err) {
                setError(err.message ?? 'Failed to load run details');
                setLoading(false);
            }
        };
        loadData();
    }, [runId]);
    useEffect(() => {
        if (run?.status !== 'running')
            return;
        const unsubscribe = subscribeToRunEvents(runId, (newEvent) => {
            setEvents((prev) => [...prev, newEvent]);
            if (autoScroll) {
                setTimeout(() => {
                    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }, (err) => console.error('SSE error:', err));
        return unsubscribe;
    }, [runId, run?.status, autoScroll]);
    const filteredEvents = useMemo(() => {
        return events.filter((event) => {
            if (eventFilters.level !== 'all' && event.level !== eventFilters.level)
                return false;
            return true;
        });
    }, [events, eventFilters]);
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
    const calculateDuration = () => {
        if (!run || !run.started_at)
            return '-';
        const start = new Date(run.started_at);
        const end = run.completed_at ? new Date(run.completed_at) : new Date();
        const diff = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
        return `${diff} minutes`;
    };
    const formatDate = (dateStr) => {
        if (!dateStr)
            return '-';
        return new Date(dateStr).toLocaleString();
    };
    const formatTime = (dateStr) => {
        return new Date(dateStr).toLocaleTimeString();
    };
    const copyRunId = () => {
        navigator.clipboard.writeText(runId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center py-12", children: _jsx("p", { className: "text-muted", children: "Loading run details..." }) }));
    }
    if (error || !run) {
        return (_jsx(Card, { className: "border-red-200 text-red-700 p-6", children: error || 'Run not found' }));
    }
    return (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 space-y-6", children: [_jsxs(Card, { children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("h1", { className: "font-display text-2xl font-bold flex items-center gap-2", children: ["Run ", run.id, _jsx("button", { onClick: copyRunId, className: "text-muted hover:text-accent", title: "Copy ID", children: _jsx(Copy, { className: "w-4 h-4" }) }), copied && _jsx("span", { className: "text-xs text-accent", children: "Copied!" })] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("span", { className: `text-xs px-2 py-1 rounded-full ${getStatusColor(run.status)}`, children: run.status }), _jsx("span", { className: "text-muted capitalize", children: run.mode })] })] }), _jsxs(Button, { variant: "ghost", onClick: onBack, children: [_jsx(ArrowLeft, { className: "w-4 h-4 mr-2" }), "Back"] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-muted", children: "Started" }), _jsx("p", { className: "font-semibold", children: formatDate(run.started_at) })] }), run.completed_at && (_jsxs("div", { children: [_jsx("p", { className: "text-muted", children: "Completed" }), _jsx("p", { className: "font-semibold", children: formatDate(run.completed_at) })] })), _jsxs("div", { children: [_jsx("p", { className: "text-muted", children: "Duration" }), _jsx("p", { className: "font-semibold", children: calculateDuration() })] }), _jsxs("div", { children: [_jsx("p", { className: "text-muted", children: "Last Updated" }), _jsx("p", { className: "font-semibold", children: formatDate(run.updated_at) })] })] }), run.error && (_jsx(Card, { className: "mt-4 border-red-200 bg-red-50 p-4", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(AlertCircle, { className: "w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-red-700", children: "Run Failed" }), _jsx("p", { className: "text-sm text-red-600 mt-1", children: run.error })] })] }) }))] }), _jsxs(Card, { children: [_jsx("h2", { className: "font-display text-xl font-semibold mb-4", children: "Metrics" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-5 gap-4", children: [_jsx(MetricCard, { label: "Discovered", value: run.metrics.discovered ?? 0, color: "accent" }), _jsx(MetricCard, { label: "Applied", value: run.metrics.applied, color: "green" }), _jsx(MetricCard, { label: "Failed", value: run.metrics.failed, color: "red" }), _jsx(MetricCard, { label: "Manual", value: run.metrics.manual_required, color: "yellow" }), _jsx(MetricCard, { label: "Skipped", value: run.metrics.skipped, color: "muted" })] })] }), _jsxs(Card, { children: [_jsx("h2", { className: "font-display text-xl font-semibold mb-4", children: "Search Configuration" }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsx(SearchConfigItem, { label: "Role keywords", value: run.search_config.role_keywords }), _jsx(SearchConfigItem, { label: "Locations", value: run.search_config.locations }), _jsx(SearchConfigItem, { label: "Remote only", value: run.search_config.remote_only }), _jsx(SearchConfigItem, { label: "Salary range", value: run.search_config.salary_min && run.search_config.salary_max
                                            ? `$${run.search_config.salary_min} - $${run.search_config.salary_max}`
                                            : undefined }), _jsx(SearchConfigItem, { label: "Max jobs per run", value: run.search_config.max_jobs_per_run }), _jsx(SearchConfigItem, { label: "Aggressive scraping", value: run.search_config.aggressive_scraping })] })] }), _jsxs(Card, { children: [_jsxs("h2", { className: "font-display text-xl font-semibold mb-4", children: ["Applications (", applications.length, ")"] }), applications.length > 0 ? (_jsx("div", { className: "space-y-2", children: applications.map((app) => (_jsx(ApplicationCard, { application: app }, app.id))) })) : (_jsx("p", { className: "text-muted text-sm", children: "No applications yet" }))] }), manualActions.length > 0 && (_jsxs(Card, { children: [_jsxs("h2", { className: "font-display text-xl font-semibold mb-4", children: ["Manual Actions (", manualActions.length, ")"] }), _jsx("div", { className: "space-y-2", children: manualActions.map((action) => (_jsx(ManualActionCard, { action: action }, action.id))) })] }))] }), _jsx("div", { className: "lg:col-span-1", children: _jsxs(Card, { className: "sticky top-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "font-display text-xl font-semibold", children: "Event Log" }), _jsx(Button, { variant: "ghost", onClick: () => setAutoScroll(!autoScroll), children: autoScroll ? _jsx(Pause, { className: "w-4 h-4" }) : _jsx(Play, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "flex gap-2 mb-4", children: _jsxs("select", { value: eventFilters.level, onChange: (e) => setEventFilters({ ...eventFilters, level: e.target.value }), className: "text-sm border rounded px-2 py-1 bg-surface", children: [_jsx("option", { value: "all", children: "All Levels" }), _jsx("option", { value: "info", children: "Info" }), _jsx("option", { value: "warning", children: "Warning" }), _jsx("option", { value: "error", children: "Error" })] }) }), _jsxs("div", { className: "space-y-2 max-h-[600px] overflow-y-auto text-sm", children: [filteredEvents.length > 0 ? (filteredEvents.map((event) => (_jsx(EventCard, { event: event }, event.id)))) : (_jsx("p", { className: "text-muted", children: "No events yet" })), _jsx("div", { ref: eventsEndRef })] })] }) })] }));
}
function MetricCard({ label, value, color }) {
    const colors = {
        accent: 'bg-accent text-white',
        green: 'bg-green-500 text-white',
        red: 'bg-red-500 text-white',
        yellow: 'bg-yellow-500 text-white',
        muted: 'bg-muted text-white',
    };
    return (_jsxs("div", { className: `p-4 rounded-lg ${colors[color]} text-center`, children: [_jsx("p", { className: "text-2xl font-bold", children: value }), _jsx("p", { className: "text-xs opacity-90", children: label })] }));
}
function SearchConfigItem({ label, value }) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0))
        return null;
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
    return (_jsxs("div", { className: "flex", children: [_jsxs("span", { className: "font-semibold w-40 text-muted", children: [label, ":"] }), _jsx("span", { children: displayValue })] }));
}
function ApplicationCard({ application }) {
    return (_jsxs("div", { className: "p-3 border rounded hover:bg-surface cursor-pointer", children: [_jsx("p", { className: "font-semibold", children: application.job.title }), _jsx("p", { className: "text-sm text-muted", children: application.job.company }), _jsx("span", { className: `text-xs px-2 py-1 rounded ${getStatusColor(application.status)}`, children: application.status })] }));
}
function ManualActionCard({ action }) {
    return (_jsxs("div", { className: "p-3 border rounded", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "font-semibold", children: action.action_type }), _jsx("span", { className: `text-xs px-2 py-1 rounded ${getStatusColor(action.status)}`, children: action.status })] }), _jsx("p", { className: "text-xs text-muted mt-1", children: new Date(action.created_at).toLocaleString() })] }));
}
function EventCard({ event }) {
    const levelColors = {
        info: 'text-muted',
        warning: 'text-yellow-500',
        error: 'text-red-500',
    };
    return (_jsxs("div", { className: `p-2 border-l-2 rounded ${levelColors[event.level] || 'text-muted'} border-${event.level === 'error' ? 'red-500' : event.level === 'warning' ? 'yellow-500' : 'accent'}`, children: [_jsxs("div", { className: "flex justify-between text-xs", children: [_jsx("span", { className: "text-muted", children: new Date(event.created_at).toLocaleTimeString() }), _jsx("span", { className: "text-accent", children: event.node || 'N/A' })] }), _jsx("p", { className: "font-medium mt-1", children: event.event_type }), _jsx("p", { className: "text-xs text-muted mt-1", children: event.message }), event.payload_json && Object.keys(event.payload_json).length > 0 && (_jsxs("details", { className: "mt-1", children: [_jsx("summary", { className: "text-xs cursor-pointer hover:text-accent", children: "Details" }), _jsx("pre", { className: "text-xs mt-1 p-2 bg-surface rounded overflow-x-auto", children: JSON.stringify(event.payload_json, null, 2) })] }))] }));
}
function getStatusColor(status) {
    const colors = {
        queued: 'bg-muted text-white',
        running: 'bg-accent text-white',
        paused: 'bg-yellow-500 text-white',
        completed: 'bg-green-500 text-white',
        failed: 'bg-red-500 text-white',
    };
    return colors[status] || 'bg-muted text-white';
}
