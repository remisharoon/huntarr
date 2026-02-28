import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, ShieldAlert } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { api } from '../lib/api';
export function ApplicationDetailPage({ applicationId, onBack }) {
    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchApplication = async () => {
            setLoading(true);
            try {
                const data = await api.getApplicationDetail(applicationId);
                setApplication(data);
            }
            catch (err) {
                setError(err.message ?? 'Failed to load application details');
            }
            finally {
                setLoading(false);
            }
        };
        fetchApplication();
    }, [applicationId]);
    if (loading) {
        return _jsx(Card, { className: "p-8 text-center", children: "Loading..." });
    }
    if (error) {
        return _jsx(Card, { className: "p-8 text-center text-red-600", children: error });
    }
    if (!application) {
        return _jsx(Card, { className: "p-8 text-center", children: "Application not found" });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex items-center gap-4", children: _jsxs(Button, { onClick: onBack, variant: "ghost", className: "border border-black/10", children: [_jsx(ArrowLeft, { size: 16, className: "mr-2" }), "Back to Jobs"] }) }), _jsxs(Card, { className: "space-y-6 p-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "font-display text-2xl", children: "Application Details" }), _jsx("p", { className: `inline-block px-3 py-1 rounded-full text-sm mt-2 ${application.status === 'submitted' ? 'bg-green-100 text-green-800' :
                                    application.status === 'failed' ? 'bg-red-100 text-red-800' :
                                        application.status === 'skipped' ? 'bg-gray-100 text-gray-800' :
                                            'bg-yellow-100 text-yellow-800'}`, children: application.status })] }), _jsxs("section", { children: [_jsx("h2", { className: "font-display text-xl mb-3", children: "Application Status" }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Status:" }), " ", application.status] }), application.source_portal && _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Source Portal:" }), " ", application.source_portal] }), application.error_code && _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Error:" }), " ", application.error_code] }), application.confirmation_text && (_jsxs("div", { children: [_jsx("span", { className: "font-semibold", children: "Confirmation:" }), _jsx("p", { className: "mt-1 text-muted", children: application.confirmation_text })] })), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Submitted:" }), " ", application.submitted_at ? new Date(application.submitted_at).toLocaleString() : 'Not submitted'] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Created:" }), " ", new Date(application.created_at).toLocaleString()] })] })] }), application.job && (_jsxs("section", { children: [_jsx("h2", { className: "font-display text-xl mb-3", children: "Job Details" }), _jsxs(Card, { className: "space-y-2", children: [_jsx("p", { className: "font-display text-lg", children: application.job.title }), _jsxs("p", { className: "text-sm text-muted", children: [application.job.company, " \u2022 ", application.job.location || 'N/A'] }), _jsxs("p", { className: "text-sm", children: ["Score: ", _jsx("span", { className: "font-semibold", children: application.job.score ? Math.round(application.job.score * 10) / 10 : 'N/A' })] }), _jsx("a", { href: application.job.url, target: "_blank", rel: "noreferrer", className: "text-accent text-sm block mt-2", children: "View Job Posting \u2192" })] })] })), application.answers && application.answers.length > 0 ? (_jsxs("section", { children: [_jsxs("h2", { className: "font-display text-xl mb-3", children: ["Application Answers (", application.answers.length, ")"] }), _jsx("div", { className: "space-y-3", children: application.answers.map((answer, idx) => (_jsxs(Card, { className: "space-y-2", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("p", { className: "font-semibold text-sm", children: ["Q: ", answer.question] }), _jsxs("span", { className: `text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2 ${answer.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                                                        answer.confidence > 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'}`, children: [Math.round(answer.confidence * 100), "% confidence"] })] }), _jsxs("p", { className: "text-sm text-muted", children: ["A: ", answer.answer] }), _jsx("p", { className: "text-xs text-muted", children: new Date(answer.created_at).toLocaleString() })] }, idx))) })] })) : null, application.generated_documents && application.generated_documents.length > 0 ? (_jsxs("section", { children: [_jsxs("h2", { className: "font-display text-xl mb-3", children: ["Generated Documents (", application.generated_documents.length, ")"] }), _jsx("div", { className: "space-y-2", children: application.generated_documents.map((doc) => (_jsxs(Card, { className: "text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "font-semibold flex items-center gap-2", children: [_jsx(FileText, { size: 16 }), doc.doc_type] }), _jsx("span", { className: "text-muted", children: new Date(doc.created_at).toLocaleString() })] }), _jsx("p", { className: "text-muted text-xs mt-1", children: doc.path })] }, doc.id))) })] })) : null, application.artifacts && Object.keys(application.artifacts).length > 0 ? (_jsxs("section", { children: [_jsx("h2", { className: "font-display text-xl mb-3", children: "Artifacts" }), _jsx(Card, { children: _jsx("pre", { className: "text-sm text-muted whitespace-pre-wrap", children: JSON.stringify(application.artifacts, null, 2) }) })] })) : null, application.manual_actions && application.manual_actions.length > 0 ? (_jsxs("section", { children: [_jsxs("h2", { className: "font-display text-xl mb-3", children: ["Manual Actions (", application.manual_actions.length, ")"] }), _jsx("div", { className: "space-y-2", children: application.manual_actions.map((action) => (_jsxs(Card, { className: "text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "font-semibold flex items-center gap-2", children: [_jsx(ShieldAlert, { size: 16 }), action.action_type] }), _jsx("span", { className: `px-2 py-1 rounded-full text-xs ${action.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        action.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                                            'bg-gray-100 text-gray-800'}`, children: action.status })] }), _jsx("p", { className: "text-muted mt-1", children: new Date(action.created_at).toLocaleString() }), action.session_url ? (_jsx("a", { href: action.session_url, target: "_blank", rel: "noreferrer", className: "text-accent text-xs mt-1 block", children: "Session URL \u2192" })) : null] }, action.id))) })] })) : null, application.run && (_jsxs("section", { children: [_jsx("h2", { className: "font-display text-xl mb-3", children: "Run Details" }), _jsxs(Card, { className: "text-sm", children: [_jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Run ID:" }), " ", application.run.id] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Status:" }), " ", application.run.status] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Mode:" }), " ", application.run.mode] }), _jsxs("p", { children: [_jsx("span", { className: "font-semibold", children: "Current Node:" }), " ", application.run.current_node || 'N/A'] })] })] }))] })] }));
}
