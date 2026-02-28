import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Button, Card, Input, TextArea } from '../components/ui';
export function ProfilePage({ profile, onSave }) {
    const [form, setForm] = useState(profile ?? {});
    const submit = async (e) => {
        e.preventDefault();
        await onSave({
            ...form,
            skills: String(form.skills || '')
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
        });
    };
    return (_jsx(Card, { children: _jsxs("form", { className: "space-y-3", onSubmit: submit, children: [_jsx("h2", { className: "font-display text-xl", children: "Profile & Rules" }), _jsx(Input, { placeholder: "Full name", value: form.full_name ?? '', onChange: (e) => setForm({ ...form, full_name: e.target.value }) }), _jsx(Input, { placeholder: "Email", value: form.email ?? '', onChange: (e) => setForm({ ...form, email: e.target.value }) }), _jsx(Input, { placeholder: "Phone", value: form.phone ?? '', onChange: (e) => setForm({ ...form, phone: e.target.value }) }), _jsx(Input, { placeholder: "Skills (comma separated)", value: Array.isArray(form.skills) ? form.skills.join(', ') : form.skills ?? '', onChange: (e) => setForm({ ...form, skills: e.target.value }) }), _jsx(TextArea, { rows: 6, placeholder: "Summary", value: form.summary ?? '', onChange: (e) => setForm({ ...form, summary: e.target.value }) }), _jsx(Button, { type: "submit", children: "Save Profile" })] }) }));
}
