import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card, Input, TextArea } from '../components/ui';
export function SettingsPage() {
    const [config, setConfig] = useState({});
    const [credentials, setCredentials] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [expanded, setExpanded] = useState({
        api: true,
        behavior: false,
        schedules: false,
    });
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [newCredential, setNewCredential] = useState({ domain: '', username: '', password: '' });
    const [newSchedule, setNewSchedule] = useState({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' });
    const [scheduleFormExpanded, setScheduleFormExpanded] = useState(false);
    const loadData = async () => {
        try {
            const [configRes, credentialsRes, schedulesRes] = await Promise.all([
                api.getConfig(),
                api.listCredentials(),
                api.listSchedules(),
            ]);
            setConfig(configRes.value || {});
            setCredentials(credentialsRes.items || []);
            setSchedules(schedulesRes.items || []);
        }
        catch (err) {
            setMessage(`Error loading settings: ${err.message}`);
        }
    };
    useEffect(() => {
        loadData();
    }, []);
    const saveConfig = async (updates) => {
        setBusy(true);
        try {
            await api.putConfig({ ...config, ...updates });
            setConfig({ ...config, ...updates });
            setMessage('Settings saved successfully');
            setTimeout(() => setMessage(null), 3000);
        }
        catch (err) {
            setMessage(`Error saving settings: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const addCredential = async (e) => {
        e.preventDefault();
        if (!newCredential.domain || !newCredential.username || !newCredential.password) {
            setMessage('Please fill in all credential fields');
            return;
        }
        setBusy(true);
        try {
            await api.storeCredential(newCredential);
            setNewCredential({ domain: '', username: '', password: '' });
            await loadData();
            setMessage('Credential added successfully');
            setTimeout(() => setMessage(null), 3000);
        }
        catch (err) {
            setMessage(`Error adding credential: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const deleteCredential = async (domain, username) => {
        if (!confirm(`Are you sure you want to delete the credential for ${username}@${domain}?`))
            return;
        setBusy(true);
        try {
            await api.deleteCredential(domain, username);
            await loadData();
            setMessage('Credential deleted successfully');
            setTimeout(() => setMessage(null), 3000);
        }
        catch (err) {
            setMessage(`Error deleting credential: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const addSchedule = async (e) => {
        e.preventDefault();
        if (!newSchedule.name || !newSchedule.cron_expr) {
            setMessage('Please fill in schedule name and cron expression');
            return;
        }
        setBusy(true);
        try {
            let payload = {};
            try {
                payload = JSON.parse(newSchedule.payload);
            }
            catch {
                setMessage('Invalid JSON in schedule payload');
                return;
            }
            await api.createSchedule({ ...newSchedule, payload });
            setNewSchedule({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' });
            setScheduleFormExpanded(false);
            await loadData();
            setMessage('Schedule created successfully');
            setTimeout(() => setMessage(null), 3000);
        }
        catch (err) {
            setMessage(`Error creating schedule: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const deleteSchedule = async (id) => {
        if (!confirm('Are you sure you want to delete this schedule?'))
            return;
        setBusy(true);
        try {
            await api.deleteSchedule(id);
            await loadData();
            setMessage('Schedule deleted successfully');
            setTimeout(() => setMessage(null), 3000);
        }
        catch (err) {
            setMessage(`Error deleting schedule: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const toggleSection = (key) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    return (_jsxs("div", { className: "space-y-4", children: [message && _jsx(Card, { className: "border-accent bg-accent/10 text-accent", children: message }), _jsxs(Card, { children: [_jsxs("div", { className: "flex cursor-pointer items-center justify-between", onClick: () => toggleSection('api'), children: [_jsx("h2", { className: "font-display text-xl", children: "API Configuration" }), expanded.api ? _jsx(ChevronUp, { size: 20 }) : _jsx(ChevronDown, { size: 20 })] }), expanded.api && (_jsx("div", { className: "mt-4 space-y-4", children: _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "font-semibold", children: "Stored API Keys" }), credentials.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No API keys stored yet." })) : (_jsx("div", { className: "space-y-2", children: credentials.map((cred, idx) => (_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-white/50 p-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: cred.domain }), _jsx("p", { className: "text-sm text-muted", children: cred.username })] }), _jsx(Button, { onClick: () => deleteCredential(cred.domain, cred.username), variant: "ghost", className: "text-red-600 hover:bg-red-50", children: _jsx(Trash2, { size: 16 }) })] }, `${cred.domain}-${cred.username}-${idx}`))) })), _jsxs("form", { onSubmit: addCredential, className: "space-y-2 rounded-lg bg-white/50 p-3", children: [_jsx(Input, { placeholder: "Domain (e.g., openai.com, brave.com)", value: newCredential.domain, onChange: (e) => setNewCredential({ ...newCredential, domain: e.target.value }) }), _jsx(Input, { placeholder: "Username (e.g., sk-*, api-key)", value: newCredential.username, onChange: (e) => setNewCredential({ ...newCredential, username: e.target.value }) }), _jsx(Input, { type: "password", placeholder: "API Key / Password", value: newCredential.password, onChange: (e) => setNewCredential({ ...newCredential, password: e.target.value }) }), _jsxs(Button, { type: "submit", disabled: busy, children: [_jsx(Plus, { size: 16, className: "mr-1" }), "Add Credential"] })] })] }) }))] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex cursor-pointer items-center justify-between", onClick: () => toggleSection('behavior'), children: [_jsx("h2", { className: "font-display text-xl", children: "Application Behavior" }), expanded.behavior ? _jsx(ChevronUp, { size: 20 }) : _jsx(ChevronDown, { size: 20 })] }), expanded.behavior && (_jsxs("div", { className: "mt-4 space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium", children: "OpenAI Model" }), _jsx(Input, { value: config.openai_model ?? 'gpt-4o-mini', onChange: (e) => setConfig({ ...config, openai_model: e.target.value }), onBlur: () => saveConfig({ openai_model: config.openai_model }) }), _jsx("p", { className: "text-xs text-muted", children: "The OpenAI model to use for AI-powered features" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: config.auto_submit_enabled ?? true, onChange: (e) => {
                                                    const newValue = e.target.checked;
                                                    setConfig({ ...config, auto_submit_enabled: newValue });
                                                    saveConfig({ auto_submit_enabled: newValue });
                                                }, className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium", children: "Auto-Submit Enabled" })] }), _jsx("p", { className: "text-xs text-muted", children: "Automatically submit applications without manual review" })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: config.browser_headless ?? true, onChange: (e) => {
                                                    const newValue = e.target.checked;
                                                    setConfig({ ...config, browser_headless: newValue });
                                                    saveConfig({ browser_headless: newValue });
                                                }, className: "rounded border-gray-300" }), _jsx("span", { className: "text-sm font-medium", children: "Headless Browser" })] }), _jsx("p", { className: "text-xs text-muted", children: "Run browser in headless mode (no GUI)" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium", children: "VNC URL" }), _jsx(Input, { value: config.vnc_url ?? 'http://localhost:7900', onChange: (e) => setConfig({ ...config, vnc_url: e.target.value }), onBlur: () => saveConfig({ vnc_url: config.vnc_url }) }), _jsx("p", { className: "text-xs text-muted", children: "URL for noVNC manual intervention sessions" })] })] }))] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex cursor-pointer items-center justify-between", onClick: () => toggleSection('schedules'), children: [_jsx("h2", { className: "font-display text-xl", children: "Scheduling" }), expanded.schedules ? _jsx(ChevronUp, { size: 20 }) : _jsx(ChevronDown, { size: 20 })] }), expanded.schedules && (_jsx("div", { className: "mt-4 space-y-4", children: _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-semibold", children: "Automated Job Hunting Schedules" }), _jsxs(Button, { onClick: () => setScheduleFormExpanded(!scheduleFormExpanded), variant: "ghost", className: "text-sm", children: [_jsx(Plus, { size: 16, className: "mr-1" }), "Add Schedule"] })] }), schedules.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No schedules configured yet." })) : (_jsx("div", { className: "space-y-2", children: schedules.map((schedule) => (_jsxs("div", { className: "flex items-center justify-between rounded-lg bg-white/50 p-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: schedule.name }), _jsxs("p", { className: "text-sm text-muted", children: [schedule.cron_expr, " (", schedule.timezone, ")"] }), _jsxs("p", { className: "text-xs text-muted", children: ["Next run: ", schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : 'N/A'] })] }), _jsx(Button, { onClick: () => deleteSchedule(schedule.id), variant: "ghost", className: "text-red-600 hover:bg-red-50", children: _jsx(Trash2, { size: 16 }) })] }, schedule.id))) })), scheduleFormExpanded && (_jsxs("form", { onSubmit: addSchedule, className: "space-y-2 rounded-lg bg-white/50 p-3", children: [_jsx(Input, { placeholder: "Schedule name (e.g., Daily Morning Hunt)", value: newSchedule.name, onChange: (e) => setNewSchedule({ ...newSchedule, name: e.target.value }) }), _jsx(Input, { placeholder: "Cron expression (e.g., 0 9 * * *)", value: newSchedule.cron_expr, onChange: (e) => setNewSchedule({ ...newSchedule, cron_expr: e.target.value }) }), _jsx(Input, { placeholder: "Timezone (e.g., UTC, America/New_York)", value: newSchedule.timezone, onChange: (e) => setNewSchedule({ ...newSchedule, timezone: e.target.value }) }), _jsx(TextArea, { rows: 3, placeholder: 'Schedule payload (JSON, e.g., {"mode": "scheduled", "search_config": {}})', value: newSchedule.payload, onChange: (e) => setNewSchedule({ ...newSchedule, payload: e.target.value }) }), _jsx(Button, { type: "submit", disabled: busy, children: "Create Schedule" }), _jsx(Button, { type: "button", onClick: () => setScheduleFormExpanded(false), variant: "ghost", children: "Cancel" })] }))] }) }))] })] }));
}
