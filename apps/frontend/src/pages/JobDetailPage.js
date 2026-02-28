import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, ShieldAlert } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { api } from '../lib/api';
export function JobDetailPage({ jobId, onBack, onViewApplication }) {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchJob = async () => {
            setLoading(true);
            try {
                const data = await api.getJobDetail(jobId);
                setJob(data);
            }
            catch (err) {
                setError(err.message ?? 'Failed to load job details');
            }
            finally {
                setLoading(false);
            }
        };
        fetchJob();
    }, [jobId]);
    if (loading) {
        return _jsx(Card, { className: "p-8 text-center", children: "Loading..." });
    }
    if (error) {
        return _jsx(Card, { className: "p-8 text-center text-red-600", children: error });
    }
    if (!job) {
        return _jsx(Card, { className: "p-8 text-center", children: "Job not found" });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex items-center gap-4", children: _jsxs(Button, { onClick: onBack, variant: "ghost", className: "border border-black/10", children: [_jsx(ArrowLeft, { size: 16, className: "mr-2" }), "Back to Jobs"] }) }), _jsxs(Card, { className: "space-y-6 p-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-2xl", children: job.title }), _jsx("p", { className: "text-lg text-muted", children: job.company })] }), _jsxs("section", { children: [_jsx("h2", { className: "font-display text-xl mb-3", children: "Job Details" }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Location:" }), " ", job.location || 'N/A'] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Source:" }), " ", job.source] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Score:" }), " ", job.score ? Math.round(job.score * 10) / 10 : 'N/A'] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Posted:" }), " ", job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'N/A'] }), _jsx("a", { href: job.url, target: "_blank", rel: "noreferrer", className: "text-accent block mt-2", children: "View Original Posting \u2192" })] })] }), job.description ? (_jsxs("section", { children: [_jsx("h2", { className: "font-display text-xl mb-3", children: "Description" }), _jsx("div", { className: "text-sm text-muted whitespace-pre-wrap", children: job.description })] })) : null, job.applications && job.applications.length > 0 ? (_jsxs("section", { children: [_jsxs("h2", { className: "font-display text-xl mb-3", children: ["Applications (", job.applications.length, ")"] }), _jsx("div", { className: "space-y-2", children: job.applications.map((app) => (_jsxs(Card, { className: "flex items-center justify-between cursor-pointer hover:bg-black/[0.02]", children: [_jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "font-semibold", children: app.status }), _jsx("span", { className: "text-muted ml-2", children: app.submitted_at ? new Date(app.submitted_at).toLocaleString() : 'Not submitted' })] }), _jsx(Button, { onClick: () => onViewApplication(app.id), variant: "ghost", className: "border border-black/10", children: "View \u2192" })] }, app.id))) })] })) : null, job.manual_actions && job.manual_actions.length > 0 ? (_jsxs("section", { children: [_jsxs("h2", { className: "font-display text-xl mb-3", children: ["Manual Actions (", job.manual_actions.length, ")"] }), _jsx("div", { className: "space-y-2", children: job.manual_actions.map((action) => (_jsxs(Card, { className: "text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "font-semibold flex items-center gap-2", children: [_jsx(ShieldAlert, { size: 16 }), action.action_type] }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs ${action.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        action.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                                            'bg-gray-100 text-gray-800'}`, children: action.status })] }), _jsx("p", { className: "text-muted mt-1", children: new Date(action.created_at).toLocaleString() }), action.session_url ? (_jsx("a", { href: action.session_url, target: "_blank", rel: "noreferrer", className: "text-accent text-xs mt-1 block", children: "Session URL \u2192" })) : null] }, action.id))) })] })) : null, job.generated_documents && job.generated_documents.length > 0 ? (_jsxs("section", { children: [_jsxs("h2", { className: "font-display text-xl mb-3", children: ["Generated Documents (", job.generated_documents.length, ")"] }), _jsx("div", { className: "space-y-2", children: job.generated_documents.map((doc) => (_jsxs(Card, { className: "text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "font-semibold flex items-center gap-2", children: [_jsx(FileText, { size: 16 }), doc.doc_type] }), _jsx("span", { className: "text-muted", children: new Date(doc.created_at).toLocaleString() })] }), _jsx("p", { className: "text-muted text-xs mt-1", children: doc.path })] }, doc.id))) })] })) : null, job.explanation && Object.keys(job.explanation).length > 0 ? (_jsxs("section", { children: [_jsx("h2", { className: "font-display text-xl mb-3", children: "Score Explanation" }), _jsx(Card, { className: "text-sm", children: _jsx("pre", { className: "text-muted whitespace-pre-wrap", children: JSON.stringify(job.explanation, null, 2) }) })] })) : null] })] }));
}
