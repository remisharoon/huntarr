import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button, Card } from '../components/ui';
export function JobsPage({ jobs, onApplyNow, onViewJob }) {
    return (_jsx("div", { className: "space-y-3", children: jobs.map((job) => (_jsxs(Card, { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between cursor-pointer hover:bg-black/[0.02]", onClick: () => onViewJob(job.id), children: [_jsxs("div", { children: [_jsx("p", { className: "font-display text-lg", children: job.title }), _jsxs("p", { className: "text-sm text-muted", children: [job.company, " \u2022 ", job.location || 'N/A', " \u2022 score ", Math.round((job.score ?? 0) * 10) / 10] }), _jsx("a", { className: "text-sm text-accent", href: job.url, target: "_blank", rel: "noreferrer", onClick: (e) => e.stopPropagation(), children: job.url })] }), _jsx(Button, { onClick: (e) => { e?.stopPropagation(); onApplyNow(job.id); }, children: "Apply Now" })] }, job.id))) }));
}
