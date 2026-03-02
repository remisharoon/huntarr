import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui';
import { api } from '../lib/api';
const DEFAULT_PROFILE = {
    full_name: '',
    email: '',
    phone: '',
    location: '',
    years_experience: 0,
    summary: '',
    skills: [],
    experience: [],
    education: [],
    awards: [],
    certifications: [],
    projects: [],
    languages: [],
    links: [],
    profile_photo_path: null,
    profile_photo_mime: null,
    preferences: {},
    rule_config: {},
    natural_language_override: null,
};
const EMPTY_EXPERIENCE = { title: '', company: '', start: '', end: '', description: '' };
const EMPTY_EDUCATION = { degree: '', institution: '', year: '', description: '' };
const EMPTY_AWARD = { title: '', issuer: '', year: '', description: '' };
const EMPTY_CERTIFICATION = { name: '', issuer: '', year: '', credential_id: '', url: '' };
const EMPTY_PROJECT = { name: '', role: '', start: '', end: '', description: '', url: '', tech_stack: [] };
const EMPTY_LANGUAGE = { name: '', proficiency: '' };
const EMPTY_LINK = { label: '', url: '' };
function asString(value) {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
}
function asInt(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return Math.max(0, Math.floor(value));
    const parsed = Number.parseInt(asString(value), 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
function asStringList(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => asString(item).trim())
            .filter(Boolean)
            .filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
    }
    return asString(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function normalizeProfile(input) {
    const source = (input ?? {});
    return {
        ...DEFAULT_PROFILE,
        ...source,
        full_name: asString(source.full_name),
        email: asString(source.email),
        phone: asString(source.phone),
        location: asString(source.location),
        years_experience: asInt(source.years_experience),
        summary: asString(source.summary),
        skills: asStringList(source.skills),
        experience: (Array.isArray(source.experience) ? source.experience : []).map((item) => ({
            ...EMPTY_EXPERIENCE,
            ...item,
            title: asString(item.title),
            company: asString(item.company),
            start: asString(item.start),
            end: asString(item.end),
            description: asString(item.description),
        })),
        education: (Array.isArray(source.education) ? source.education : []).map((item) => ({
            ...EMPTY_EDUCATION,
            ...item,
            degree: asString(item.degree),
            institution: asString(item.institution),
            year: asString(item.year),
            description: asString(item.description),
        })),
        awards: (Array.isArray(source.awards) ? source.awards : []).map((item) => ({
            ...EMPTY_AWARD,
            ...item,
            title: asString(item.title),
            issuer: asString(item.issuer),
            year: asString(item.year),
            description: asString(item.description),
        })),
        certifications: (Array.isArray(source.certifications) ? source.certifications : []).map((item) => ({
            ...EMPTY_CERTIFICATION,
            ...item,
            name: asString(item.name),
            issuer: asString(item.issuer),
            year: asString(item.year),
            credential_id: asString(item.credential_id),
            url: asString(item.url),
        })),
        projects: (Array.isArray(source.projects) ? source.projects : []).map((item) => ({
            ...EMPTY_PROJECT,
            ...item,
            name: asString(item.name),
            role: asString(item.role),
            start: asString(item.start),
            end: asString(item.end),
            description: asString(item.description),
            url: asString(item.url),
            tech_stack: asStringList(item.tech_stack),
        })),
        languages: (Array.isArray(source.languages) ? source.languages : []).map((item) => ({
            ...EMPTY_LANGUAGE,
            ...item,
            name: asString(item.name),
            proficiency: asString(item.proficiency),
        })),
        links: (Array.isArray(source.links) ? source.links : []).map((item) => ({
            ...EMPTY_LINK,
            ...item,
            label: asString(item.label),
            url: asString(item.url),
        })),
        profile_photo_path: source.profile_photo_path ? asString(source.profile_photo_path) : null,
        profile_photo_mime: source.profile_photo_mime ? asString(source.profile_photo_mime) : null,
        preferences: (source.preferences ?? {}),
        rule_config: (source.rule_config ?? {}),
        natural_language_override: source.natural_language_override ? asString(source.natural_language_override) : null,
    };
}
export function ProfilePage({ profile, onSave }) {
    const [form, setForm] = useState(normalizeProfile(profile));
    const [saving, setSaving] = useState(false);
    const [resumeStatus, setResumeStatus] = useState('idle');
    const [resumeFileName, setResumeFileName] = useState('');
    const [resumeError, setResumeError] = useState('');
    const fileInputRef = useRef(null);
    const hasImportedRef = useRef(false);
    useEffect(() => {
        if (hasImportedRef.current)
            return;
        setForm(normalizeProfile(profile));
    }, [profile]);
    const completeness = useMemo(() => {
        const checks = [
            Boolean(form.full_name),
            Boolean(form.email),
            Boolean(form.phone),
            Boolean(form.summary),
            form.skills.length > 0,
            form.experience.length > 0,
            form.education.length > 0,
        ];
        return Math.round((checks.filter(Boolean).length / checks.length) * 100);
    }, [form]);
    const handleResumeUpload = async (file) => {
        setResumeFileName(file.name);
        setResumeStatus('uploading');
        setResumeError('');
        try {
            const extracted = await api.importResume(file);
            hasImportedRef.current = true;
            setForm((prev) => normalizeProfile({ ...prev, ...extracted }));
            setResumeStatus('done');
        }
        catch (err) {
            setResumeError(err?.message ?? 'Upload failed');
            setResumeStatus('error');
        }
    };
    const updateSectionItem = (key, index, item) => {
        setForm((prev) => {
            const current = [...prev[key]];
            current[index] = item;
            return normalizeProfile({ ...prev, [key]: current });
        });
    };
    const addSectionItem = (key) => {
        const emptyItemByKey = {
            experience: EMPTY_EXPERIENCE,
            education: EMPTY_EDUCATION,
            awards: EMPTY_AWARD,
            certifications: EMPTY_CERTIFICATION,
            projects: EMPTY_PROJECT,
            languages: EMPTY_LANGUAGE,
            links: EMPTY_LINK,
        };
        setForm((prev) => normalizeProfile({ ...prev, [key]: [...prev[key], emptyItemByKey[key]] }));
    };
    const removeSectionItem = (key, index) => {
        setForm((prev) => {
            const current = [...prev[key]];
            current.splice(index, 1);
            return normalizeProfile({ ...prev, [key]: current });
        });
    };
    const submit = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            await onSave(normalizeProfile(form));
            hasImportedRef.current = false;
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("form", { className: "space-y-4", onSubmit: submit, children: [_jsx(PageHeader, { title: "Profile", subtitle: "Structured profile data used for applications, generated answers, and outbound submissions.", actions: _jsxs(Badge, { tone: completeness >= 80 ? 'success' : 'warning', children: [completeness, "% complete"] }) }), _jsxs(Card, { className: "space-y-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Resume Intelligence" }), _jsx("p", { className: "text-sm text-muted", children: "Upload a PDF resume to auto-populate your profile, extract profile photo, and regenerate a professional summary." }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".pdf", className: "hidden", onChange: (e) => {
                            const file = e.target.files?.[0];
                            if (file)
                                handleResumeUpload(file);
                            e.target.value = '';
                        } }), _jsxs("div", { className: "resume-upload-cta flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4", children: [_jsxs(Button, { type: "button", variant: "attention", className: "resume-upload-button", disabled: resumeStatus === 'uploading', onClick: () => fileInputRef.current?.click(), children: [_jsx(UploadCloud, { size: 16 }), resumeStatus === 'uploading' ? 'Parsing resume...' : 'Upload PDF Resume'] }), _jsxs(Badge, { tone: "info", className: "gap-1", children: [_jsx(Sparkles, { size: 12 }), " AI profile extraction"] }), resumeStatus === 'uploading' && _jsx("span", { className: "text-sm text-muted", children: "Extracting identity, experience, education, skills, achievements, and links..." }), resumeStatus === 'done' && _jsxs("span", { className: "text-sm text-success", children: ["Profile refreshed from ", resumeFileName] }), resumeStatus === 'error' && _jsx("span", { className: "text-sm text-danger", children: resumeError })] }), form.profile_photo_path ? (_jsxs("div", { className: "flex items-center gap-3 rounded-xl border border-border bg-elevated/50 p-3", children: [_jsx("img", { src: api.profilePhotoUrl(form.profile_photo_path), alt: "Extracted profile", className: "h-16 w-16 rounded-full border border-border object-cover" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-text", children: "Extracted profile photo ready for job applications" }), _jsx("p", { className: "truncate text-xs text-muted", children: form.profile_photo_path })] })] })) : null] }), _jsxs(Card, { className: "space-y-4", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Identity" }), _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Full name", value: form.full_name, onChange: (event) => setForm((prev) => ({ ...prev, full_name: event.target.value })) }), _jsx(Input, { placeholder: "Email", value: form.email, onChange: (event) => setForm((prev) => ({ ...prev, email: event.target.value })) }), _jsx(Input, { placeholder: "Phone", value: form.phone ?? '', onChange: (event) => setForm((prev) => ({ ...prev, phone: event.target.value })) }), _jsx(Input, { placeholder: "Location", value: form.location ?? '', onChange: (event) => setForm((prev) => ({ ...prev, location: event.target.value })) }), _jsx(Input, { type: "number", min: 0, placeholder: "Years of experience", value: String(form.years_experience ?? 0), onChange: (event) => setForm((prev) => ({ ...prev, years_experience: asInt(event.target.value) })) })] })] }), _jsxs(Card, { className: "space-y-4", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Professional Summary" }), _jsx(Input, { placeholder: "Skills (comma separated)", value: form.skills.join(', '), onChange: (event) => setForm((prev) => ({ ...prev, skills: asStringList(event.target.value) })) }), _jsx(TextArea, { rows: 7, placeholder: "Summary used for answer generation and profile tailoring", value: form.summary, onChange: (event) => setForm((prev) => ({ ...prev, summary: event.target.value })) })] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Experience" }), _jsxs(Button, { type: "button", variant: "secondary", onClick: () => addSectionItem('experience'), children: [_jsx(Plus, { size: 14 }), " Add"] })] }), form.experience.length === 0 ? _jsx("p", { className: "text-sm text-muted", children: "No experience entries yet." }) : null, form.experience.map((item, index) => (_jsxs(Card, { variant: "muted", className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Title", value: item.title, onChange: (e) => updateSectionItem('experience', index, { ...item, title: e.target.value }) }), _jsx(Input, { placeholder: "Company", value: item.company, onChange: (e) => updateSectionItem('experience', index, { ...item, company: e.target.value }) }), _jsx(Input, { placeholder: "Start", value: item.start, onChange: (e) => updateSectionItem('experience', index, { ...item, start: e.target.value }) }), _jsx(Input, { placeholder: "End", value: item.end, onChange: (e) => updateSectionItem('experience', index, { ...item, end: e.target.value }) })] }), _jsx(TextArea, { rows: 4, placeholder: "Description", value: item.description, onChange: (e) => updateSectionItem('experience', index, { ...item, description: e.target.value }) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeSectionItem('experience', index), children: [_jsx(Trash2, { size: 14 }), " Remove"] }) })] }, `exp-${index}`)))] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Education" }), _jsxs(Button, { type: "button", variant: "secondary", onClick: () => addSectionItem('education'), children: [_jsx(Plus, { size: 14 }), " Add"] })] }), form.education.length === 0 ? _jsx("p", { className: "text-sm text-muted", children: "No education entries yet." }) : null, form.education.map((item, index) => (_jsxs(Card, { variant: "muted", className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsx(Input, { placeholder: "Degree", value: item.degree, onChange: (e) => updateSectionItem('education', index, { ...item, degree: e.target.value }) }), _jsx(Input, { placeholder: "Institution", value: item.institution, onChange: (e) => updateSectionItem('education', index, { ...item, institution: e.target.value }) }), _jsx(Input, { placeholder: "Year", value: item.year, onChange: (e) => updateSectionItem('education', index, { ...item, year: e.target.value }) })] }), _jsx(TextArea, { rows: 3, placeholder: "Details", value: item.description, onChange: (e) => updateSectionItem('education', index, { ...item, description: e.target.value }) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeSectionItem('education', index), children: [_jsx(Trash2, { size: 14 }), " Remove"] }) })] }, `edu-${index}`)))] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Projects" }), _jsxs(Button, { type: "button", variant: "secondary", onClick: () => addSectionItem('projects'), children: [_jsx(Plus, { size: 14 }), " Add"] })] }), form.projects.length === 0 ? _jsx("p", { className: "text-sm text-muted", children: "No projects entries yet." }) : null, form.projects.map((item, index) => (_jsxs(Card, { variant: "muted", className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Project name", value: item.name, onChange: (e) => updateSectionItem('projects', index, { ...item, name: e.target.value }) }), _jsx(Input, { placeholder: "Role", value: item.role, onChange: (e) => updateSectionItem('projects', index, { ...item, role: e.target.value }) }), _jsx(Input, { placeholder: "Start", value: item.start, onChange: (e) => updateSectionItem('projects', index, { ...item, start: e.target.value }) }), _jsx(Input, { placeholder: "End", value: item.end, onChange: (e) => updateSectionItem('projects', index, { ...item, end: e.target.value }) }), _jsx(Input, { placeholder: "Project URL", value: item.url, onChange: (e) => updateSectionItem('projects', index, { ...item, url: e.target.value }), className: "md:col-span-2" }), _jsx(Input, { placeholder: "Tech stack (comma separated)", value: item.tech_stack.join(', '), onChange: (e) => updateSectionItem('projects', index, { ...item, tech_stack: asStringList(e.target.value) }), className: "md:col-span-2" })] }), _jsx(TextArea, { rows: 4, placeholder: "Project description", value: item.description, onChange: (e) => updateSectionItem('projects', index, { ...item, description: e.target.value }) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeSectionItem('projects', index), children: [_jsx(Trash2, { size: 14 }), " Remove"] }) })] }, `proj-${index}`)))] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Awards" }), _jsxs(Button, { type: "button", variant: "secondary", onClick: () => addSectionItem('awards'), children: [_jsx(Plus, { size: 14 }), " Add"] })] }), form.awards.length === 0 ? _jsx("p", { className: "text-sm text-muted", children: "No award entries yet." }) : null, form.awards.map((item, index) => (_jsxs(Card, { variant: "muted", className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsx(Input, { placeholder: "Award title", value: item.title, onChange: (e) => updateSectionItem('awards', index, { ...item, title: e.target.value }) }), _jsx(Input, { placeholder: "Issuer", value: item.issuer, onChange: (e) => updateSectionItem('awards', index, { ...item, issuer: e.target.value }) }), _jsx(Input, { placeholder: "Year", value: item.year, onChange: (e) => updateSectionItem('awards', index, { ...item, year: e.target.value }) })] }), _jsx(TextArea, { rows: 3, placeholder: "Description", value: item.description, onChange: (e) => updateSectionItem('awards', index, { ...item, description: e.target.value }) }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeSectionItem('awards', index), children: [_jsx(Trash2, { size: 14 }), " Remove"] }) })] }, `award-${index}`)))] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Certifications" }), _jsxs(Button, { type: "button", variant: "secondary", onClick: () => addSectionItem('certifications'), children: [_jsx(Plus, { size: 14 }), " Add"] })] }), form.certifications.length === 0 ? _jsx("p", { className: "text-sm text-muted", children: "No certification entries yet." }) : null, form.certifications.map((item, index) => (_jsxs(Card, { variant: "muted", className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Certification", value: item.name, onChange: (e) => updateSectionItem('certifications', index, { ...item, name: e.target.value }) }), _jsx(Input, { placeholder: "Issuer", value: item.issuer, onChange: (e) => updateSectionItem('certifications', index, { ...item, issuer: e.target.value }) }), _jsx(Input, { placeholder: "Year", value: item.year, onChange: (e) => updateSectionItem('certifications', index, { ...item, year: e.target.value }) }), _jsx(Input, { placeholder: "Credential ID", value: item.credential_id, onChange: (e) => updateSectionItem('certifications', index, { ...item, credential_id: e.target.value }) }), _jsx(Input, { placeholder: "Credential URL", value: item.url, onChange: (e) => updateSectionItem('certifications', index, { ...item, url: e.target.value }), className: "md:col-span-2" })] }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeSectionItem('certifications', index), children: [_jsx(Trash2, { size: 14 }), " Remove"] }) })] }, `cert-${index}`)))] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Languages" }), _jsxs(Button, { type: "button", variant: "secondary", onClick: () => addSectionItem('languages'), children: [_jsx(Plus, { size: 14 }), " Add"] })] }), form.languages.length === 0 ? _jsx("p", { className: "text-sm text-muted", children: "No language entries yet." }) : null, form.languages.map((item, index) => (_jsxs(Card, { variant: "muted", className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Language", value: item.name, onChange: (e) => updateSectionItem('languages', index, { ...item, name: e.target.value }) }), _jsx(Input, { placeholder: "Proficiency", value: item.proficiency, onChange: (e) => updateSectionItem('languages', index, { ...item, proficiency: e.target.value }) })] }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeSectionItem('languages', index), children: [_jsx(Trash2, { size: 14 }), " Remove"] }) })] }, `lang-${index}`)))] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Links" }), _jsxs(Button, { type: "button", variant: "secondary", onClick: () => addSectionItem('links'), children: [_jsx(Plus, { size: 14 }), " Add"] })] }), form.links.length === 0 ? _jsx("p", { className: "text-sm text-muted", children: "No link entries yet." }) : null, form.links.map((item, index) => (_jsxs(Card, { variant: "muted", className: "space-y-3", children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Label", value: item.label, onChange: (e) => updateSectionItem('links', index, { ...item, label: e.target.value }) }), _jsx(Input, { placeholder: "URL", value: item.url, onChange: (e) => updateSectionItem('links', index, { ...item, url: e.target.value }) })] }), _jsx("div", { className: "flex justify-end", children: _jsxs(Button, { type: "button", variant: "ghost", onClick: () => removeSectionItem('links', index), children: [_jsx(Trash2, { size: 14 }), " Remove"] }) })] }, `link-${index}`)))] }), _jsx("div", { className: "sticky bottom-3 z-10 flex justify-end", children: _jsxs(Card, { className: "inline-flex items-center gap-3 rounded-2xl border-border bg-surface/95 p-3 shadow-panel", children: [_jsx("p", { className: "text-xs text-muted", children: "Changes are applied to profile API on save." }), _jsx(Button, { type: "submit", disabled: saving, children: saving ? 'Saving...' : 'Save Profile' })] }) })] }));
}
