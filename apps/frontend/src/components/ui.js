import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../lib/utils';
export function Card({ className, children, onClick }) {
    return _jsx("div", { className: cn('rounded-2xl border border-black/5 bg-white/80 p-4 shadow-card backdrop-blur', className), onClick: onClick, children: children });
}
export function Button({ className, children, onClick, disabled, variant = 'primary', type = 'button', }) {
    const variants = {
        primary: 'bg-accent text-white hover:opacity-90',
        secondary: 'bg-ink text-white hover:opacity-90',
        ghost: 'bg-transparent text-ink hover:bg-black/5',
    };
    return (_jsx("button", { type: type, disabled: disabled, onClick: onClick, className: cn('rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50', variants[variant], className), children: children }));
}
export function Input(props) {
    return _jsx("input", { ...props, className: cn('w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm', props.className) });
}
export function TextArea(props) {
    return _jsx("textarea", { ...props, className: cn('w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm', props.className) });
}
