import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { ExternalLink, Eye, Send } from 'lucide-react';
import { Badge, Button, Card, IconButton, Input, PageHeader, SegmentedControl } from '../components/ui';
export function JobsPage({ jobs, onApplyNow, onViewJob, }) {
    const [query, setQuery] = useState('');
    const [scoreBand, setScoreBand] = useState('all');
    const filteredJobs = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return jobs.filter((job) => {
            if (scoreBand === 'high' && (job.score ?? 0) < 0.75)
                return false;
            if (scoreBand === 'medium' && ((job.score ?? 0) < 0.5 || (job.score ?? 0) >= 0.75))
                return false;
            if (!normalized)
                return true;
            const fields = [job.title, job.company, job.location, job.source]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return fields.includes(normalized);
        });
    }, [jobs, query, scoreBand]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Jobs", subtitle: "Dense list optimized for quick scan and actions.", actions: _jsxs(_Fragment, { children: [_jsx(Input, { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "Search title, company, location", className: "w-64" }), _jsx(SegmentedControl, { value: scoreBand, onChange: setScoreBand, options: [
                                { value: 'all', label: 'All scores' },
                                { value: 'high', label: 'High 0.75+' },
                                { value: 'medium', label: 'Mid 0.5-0.74' },
                            ] })] }) }), _jsxs(Card, { className: "overflow-hidden p-0", children: [_jsxs("div", { className: "hidden grid-cols-[1.7fr_1fr_0.6fr_1fr_0.8fr_auto] gap-2 border-b border-border bg-elevated/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted md:grid", children: [_jsx("span", { children: "Role" }), _jsx("span", { children: "Company" }), _jsx("span", { children: "Score" }), _jsx("span", { children: "Location" }), _jsx("span", { children: "Source" }), _jsx("span", { children: "Actions" })] }), filteredJobs.length === 0 ? (_jsx("div", { className: "px-4 py-8 text-center text-sm text-muted", children: "No jobs match this filter." })) : (_jsx("div", { className: "divide-y divide-border", children: filteredJobs.map((job) => {
                            const score = Math.round((job.score ?? 0) * 100) / 100;
                            return (_jsxs("div", { className: "grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1.7fr_1fr_0.6fr_1fr_0.8fr_auto] md:items-center", children: [_jsxs("button", { type: "button", className: "text-left", onClick: () => onViewJob(job.id), children: [_jsx("p", { className: "truncate font-semibold text-text", children: job.title || 'Untitled role' }), _jsx("p", { className: "mt-1 text-xs text-muted md:hidden", children: job.company || 'Unknown company' })] }), _jsx("p", { className: "hidden text-sm text-text md:block", children: job.company || 'Unknown company' }), _jsx("div", { children: _jsx(Badge, { tone: score >= 0.75 ? 'success' : score >= 0.5 ? 'warning' : 'default', children: Number.isFinite(score) ? score.toFixed(2) : 'N/A' }) }), _jsx("p", { className: "text-sm text-muted", children: job.location || 'N/A' }), _jsx("p", { className: "text-sm text-muted", children: job.source || 'unknown' }), _jsxs("div", { className: "flex items-center justify-start gap-1 md:justify-end", children: [_jsxs(Button, { onClick: () => onApplyNow(job.id), className: "h-8 px-2 text-xs", children: [_jsx(Send, { size: 14 }), "Apply"] }), _jsx(IconButton, { title: "View details", onClick: () => onViewJob(job.id), children: _jsx(Eye, { size: 14 }) }), _jsx(IconButton, { title: "Open source", onClick: () => {
                                                    if (!job.url)
                                                        return;
                                                    window.open(job.url, '_blank', 'noreferrer');
                                                }, children: _jsx(ExternalLink, { size: 14 }) })] })] }, job.id));
                        }) }))] })] }));
}
