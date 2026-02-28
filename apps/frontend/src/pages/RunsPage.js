import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Card } from '../components/ui';
export function RunsPage({ runs }) {
    return (_jsx("div", { className: "space-y-3", children: runs.map((run) => (_jsxs(Card, { children: [_jsxs("p", { className: "font-display text-lg", children: ["Run ", run.id] }), _jsxs("p", { className: "text-sm text-muted", children: [run.status, " \u2022 ", run.mode, " \u2022 node ", run.current_node || 'n/a'] })] }, run.id))) }));
}
