import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui';
const defaultProviderForm = {
    name: '',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    api_key: '',
};
export function SettingsPage() {
    const [config, setConfig] = useState({});
    const [credentials, setCredentials] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [providers, setProviders] = useState([]);
    const [activeProviderId, setActiveProviderId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const [editingProviderId, setEditingProviderId] = useState(null);
    const [providerForm, setProviderForm] = useState({ ...defaultProviderForm });
    const [newCredential, setNewCredential] = useState({ domain: '', username: '', password: '' });
    const [newSchedule, setNewSchedule] = useState({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' });
    const flashMessage = (text) => {
        setMessage(text);
        setTimeout(() => setMessage(null), 2500);
    };
    const resetProviderForm = () => {
        setEditingProviderId(null);
        setProviderForm({ ...defaultProviderForm });
    };
    const loadData = async () => {
        try {
            const [configRes, credentialsRes, schedulesRes, providersRes] = await Promise.all([
                api.getConfig(),
                api.listCredentials(),
                api.listSchedules(),
                api.listLLMProviders(),
            ]);
            setConfig(configRes.value || {});
            setCredentials(credentialsRes.items || []);
            setSchedules(schedulesRes.items || []);
            setProviders(providersRes.items || []);
            setActiveProviderId(providersRes.active_provider_id ?? null);
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
            const nextValue = { ...config, ...updates };
            await api.putConfig(nextValue);
            setConfig(nextValue);
            flashMessage('Settings saved successfully');
        }
        catch (err) {
            setMessage(`Error saving settings: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const beginEditProvider = (provider) => {
        setEditingProviderId(provider.id);
        setProviderForm({
            name: provider.name,
            base_url: provider.base_url,
            model: provider.model,
            api_key: '',
        });
    };
    const saveProvider = async (event) => {
        event.preventDefault();
        const name = providerForm.name.trim();
        const baseUrl = providerForm.base_url.trim();
        const model = providerForm.model.trim();
        const apiKey = providerForm.api_key.trim();
        if (!name || !baseUrl || !model) {
            setMessage('Provider name, base URL, and model are required');
            return;
        }
        const payload = {
            name,
            base_url: baseUrl,
            model,
        };
        if (apiKey) {
            payload.api_key = apiKey;
        }
        setBusy(true);
        try {
            if (editingProviderId) {
                await api.updateLLMProvider(editingProviderId, payload);
                flashMessage('Provider updated successfully');
            }
            else {
                await api.createLLMProvider(payload);
                flashMessage('Provider created successfully');
            }
            resetProviderForm();
            await loadData();
        }
        catch (err) {
            setMessage(`Error saving provider: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const testProviderFromForm = async () => {
        const name = providerForm.name.trim();
        const baseUrl = providerForm.base_url.trim();
        const model = providerForm.model.trim();
        const apiKey = providerForm.api_key.trim();
        if (!name || !baseUrl || !model) {
            setMessage('Provider name, base URL, and model are required for test');
            return;
        }
        if (!editingProviderId && !apiKey) {
            setMessage('API key is required to test an unsaved provider');
            return;
        }
        const payload = {
            base_url: baseUrl,
            model,
        };
        if (editingProviderId) {
            payload.provider_id = editingProviderId;
        }
        if (apiKey) {
            payload.api_key = apiKey;
        }
        setBusy(true);
        try {
            const result = await api.testLLMProvider(payload);
            flashMessage(result.message || 'Provider test succeeded');
        }
        catch (err) {
            setMessage(`Provider test failed: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const testProviderById = async (providerId) => {
        setBusy(true);
        try {
            const result = await api.testLLMProvider({ provider_id: providerId });
            flashMessage(result.message || 'Provider test succeeded');
        }
        catch (err) {
            setMessage(`Provider test failed: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const activateProvider = async (providerId) => {
        setBusy(true);
        try {
            await api.activateLLMProvider(providerId);
            await loadData();
            flashMessage('Active provider updated');
        }
        catch (err) {
            setMessage(`Error setting active provider: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const removeProvider = async (provider) => {
        if (!window.confirm(`Delete LLM provider "${provider.name}"?`))
            return;
        setBusy(true);
        try {
            await api.deleteLLMProvider(provider.id);
            if (editingProviderId === provider.id) {
                resetProviderForm();
            }
            await loadData();
            flashMessage('Provider deleted successfully');
        }
        catch (err) {
            setMessage(`Error deleting provider: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const addCredential = async (event) => {
        event.preventDefault();
        if (!newCredential.domain || !newCredential.username || !newCredential.password) {
            setMessage('Please fill in all credential fields');
            return;
        }
        setBusy(true);
        try {
            await api.storeCredential(newCredential);
            setNewCredential({ domain: '', username: '', password: '' });
            await loadData();
            flashMessage('Credential added successfully');
        }
        catch (err) {
            setMessage(`Error adding credential: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const deleteCredential = async (domain, username) => {
        if (!window.confirm(`Delete credential for ${username}@${domain}?`))
            return;
        setBusy(true);
        try {
            await api.deleteCredential(domain, username);
            await loadData();
            flashMessage('Credential deleted successfully');
        }
        catch (err) {
            setMessage(`Error deleting credential: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const addSchedule = async (event) => {
        event.preventDefault();
        if (!newSchedule.name || !newSchedule.cron_expr) {
            setMessage('Schedule name and cron expression are required');
            return;
        }
        let payload = {};
        try {
            payload = JSON.parse(newSchedule.payload);
        }
        catch {
            setMessage('Invalid JSON in schedule payload');
            return;
        }
        setBusy(true);
        try {
            await api.createSchedule({ ...newSchedule, payload });
            setNewSchedule({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' });
            await loadData();
            flashMessage('Schedule created successfully');
        }
        catch (err) {
            setMessage(`Error creating schedule: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    const deleteSchedule = async (id) => {
        if (!window.confirm('Delete this schedule?'))
            return;
        setBusy(true);
        try {
            await api.deleteSchedule(id);
            await loadData();
            flashMessage('Schedule deleted successfully');
        }
        catch (err) {
            setMessage(`Error deleting schedule: ${err.message}`);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { title: "Settings", subtitle: "Configure LLM providers, ATS credentials, behavior flags, and scheduling.", actions: _jsx(Badge, { tone: busy ? 'warning' : 'success', children: busy ? 'Processing' : 'Ready' }) }), message ? _jsx(Card, { variant: "muted", className: "border-accent/50 text-accent", children: message }) : null, _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "LLM Providers (OpenAI-compatible)" }), _jsx(Badge, { tone: "info", children: providers.length })] }), _jsxs("div", { className: "space-y-1 text-xs text-muted", children: [_jsx("p", { children: "Active provider is used for resume parsing and AI-powered features." }), _jsx("p", { children: "Endpoint must support OpenAI Chat Completions." }), _jsx("p", { children: "API keys are encrypted at rest." })] }), providers.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No LLM providers configured yet." })) : (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "hidden grid-cols-[1fr_1.1fr_0.8fr_0.6fr_0.6fr_auto] gap-2 rounded-xl border border-border bg-elevated/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted md:grid", children: [_jsx("span", { children: "Name" }), _jsx("span", { children: "Base URL" }), _jsx("span", { children: "Model" }), _jsx("span", { children: "Key" }), _jsx("span", { children: "Status" }), _jsx("span", { children: "Actions" })] }), providers.map((provider) => (_jsxs("div", { className: "grid grid-cols-1 gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2 md:grid-cols-[1fr_1.1fr_0.8fr_0.6fr_0.6fr_auto] md:items-center", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted md:hidden", children: "Name" }), _jsx("p", { className: "font-semibold text-text", children: provider.name })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted md:hidden", children: "Base URL" }), _jsx("p", { className: "truncate text-sm text-text", children: provider.base_url })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted md:hidden", children: "Model" }), _jsx("p", { className: "text-sm text-text", children: provider.model })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted md:hidden", children: "Key" }), _jsx("p", { className: "text-sm text-text", children: !provider.has_api_key ? 'Missing' : provider.key_source === 'vault' ? 'Vault' : 'Env fallback' })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-muted md:hidden", children: "Status" }), _jsx(Badge, { tone: provider.id === activeProviderId ? 'success' : 'default', children: provider.id === activeProviderId ? 'Active' : 'Inactive' })] }), _jsxs("div", { className: "flex flex-wrap gap-1", children: [_jsx(Button, { variant: "secondary", className: "h-8 px-2 text-xs", onClick: () => testProviderById(provider.id), children: "Test provider" }), _jsxs(Button, { variant: "ghost", className: "h-8 px-2 text-xs", onClick: () => beginEditProvider(provider), children: [_jsx(Pencil, { size: 14 }), " Edit"] }), _jsxs(Button, { variant: "ghost", className: "h-8 px-2 text-xs", disabled: provider.id === activeProviderId, onClick: () => activateProvider(provider.id), children: [_jsx(Check, { size: 14 }), " Set active"] }), _jsxs(Button, { variant: "danger", className: "h-8 px-2 text-xs", onClick: () => removeProvider(provider), children: [_jsx(Trash2, { size: 14 }), " Delete"] })] })] }, provider.id)))] })), _jsxs("form", { onSubmit: saveProvider, className: "space-y-2 rounded-xl border border-border bg-elevated/50 p-3", children: [_jsx("p", { className: "text-sm font-semibold text-text", children: editingProviderId ? 'Edit provider' : 'Add provider' }), _jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Provider name", value: providerForm.name, onChange: (event) => setProviderForm({ ...providerForm, name: event.target.value }) }), _jsx(Input, { placeholder: "Base URL", value: providerForm.base_url, onChange: (event) => setProviderForm({ ...providerForm, base_url: event.target.value }) }), _jsx(Input, { placeholder: "Model", value: providerForm.model, onChange: (event) => setProviderForm({ ...providerForm, model: event.target.value }) }), _jsx(Input, { type: "password", placeholder: "API key", value: providerForm.api_key, onChange: (event) => setProviderForm({ ...providerForm, api_key: event.target.value }) })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", className: "h-8 px-2 text-xs", onClick: testProviderFromForm, children: "Test provider" }), _jsxs(Button, { type: "submit", disabled: busy, className: "h-8 px-2 text-xs", children: [_jsx(Plus, { size: 14 }), " Save provider"] }), editingProviderId ? (_jsx(Button, { type: "button", variant: "ghost", className: "h-8 px-2 text-xs", onClick: resetProviderForm, children: "Cancel edit" })) : null] })] })] }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-2", children: [_jsxs(Card, { className: "space-y-4", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Application Behavior" }), _jsxs("div", { className: "space-y-2 rounded-xl border border-border bg-elevated/50 p-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm font-semibold text-text", children: [_jsx("input", { type: "checkbox", checked: config.auto_submit_enabled ?? true, onChange: (event) => {
                                                    const value = event.target.checked;
                                                    setConfig({ ...config, auto_submit_enabled: value });
                                                    saveConfig({ auto_submit_enabled: value });
                                                } }), "Auto-submit applications"] }), _jsx("p", { className: "text-xs text-muted", children: "Immediately submit eligible forms without manual review." })] }), _jsxs("div", { className: "space-y-2 rounded-xl border border-border bg-elevated/50 p-3", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm font-semibold text-text", children: [_jsx("input", { type: "checkbox", checked: config.browser_headless ?? true, onChange: (event) => {
                                                    const value = event.target.checked;
                                                    setConfig({ ...config, browser_headless: value });
                                                    saveConfig({ browser_headless: value });
                                                } }), "Headless browser"] }), _jsx("p", { className: "text-xs text-muted", children: "Disable only when visual debugging is necessary." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-semibold text-text", children: "noVNC URL" }), _jsx(Input, { value: config.vnc_url ?? 'http://localhost:7900', onChange: (event) => setConfig({ ...config, vnc_url: event.target.value }), onBlur: () => saveConfig({ vnc_url: config.vnc_url }) })] })] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "ATS Credentials" }), _jsx(Badge, { tone: "info", children: credentials.length })] }), _jsx("p", { className: "text-xs text-muted", children: "Used for Greenhouse/Lever/Workday login. Not used for LLM providers." }), credentials.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No ATS credentials stored yet." })) : (_jsx("div", { className: "space-y-2", children: credentials.map((credential, index) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-border bg-elevated/60 px-3 py-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-text", children: credential.domain }), _jsx("p", { className: "text-xs text-muted", children: credential.username })] }), _jsxs(Button, { variant: "danger", className: "h-8 px-2 text-xs", onClick: () => deleteCredential(credential.domain, credential.username), children: [_jsx(Trash2, { size: 14 }), " Delete"] })] }, `${credential.domain}-${credential.username}-${index}`))) })), _jsxs("form", { onSubmit: addCredential, className: "space-y-2 rounded-xl border border-border bg-elevated/50 p-3", children: [_jsx("p", { className: "text-sm font-semibold text-text", children: "Add credential" }), _jsx(Input, { placeholder: "ATS domain (e.g. acme.greenhouse.io)", value: newCredential.domain, onChange: (event) => setNewCredential({ ...newCredential, domain: event.target.value }) }), _jsx(Input, { placeholder: "Login email or username", value: newCredential.username, onChange: (event) => setNewCredential({ ...newCredential, username: event.target.value }) }), _jsx(Input, { type: "password", placeholder: "Password", value: newCredential.password, onChange: (event) => setNewCredential({ ...newCredential, password: event.target.value }) }), _jsxs(Button, { type: "submit", disabled: busy, className: "h-8 px-2 text-xs", children: [_jsx(Plus, { size: 14 }), " Add Credential"] })] })] })] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-xl text-text", children: "Scheduling" }), _jsxs(Badge, { tone: "default", children: [schedules.length, " schedules"] })] }), schedules.length === 0 ? (_jsx("p", { className: "text-sm text-muted", children: "No schedules configured yet." })) : (_jsx("div", { className: "space-y-2", children: schedules.map((schedule) => (_jsxs("div", { className: "grid grid-cols-1 gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2 md:grid-cols-[1.5fr_1fr_auto] md:items-center", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-text", children: schedule.name }), _jsxs("p", { className: "text-xs text-muted", children: [schedule.cron_expr, " (", schedule.timezone, ")"] })] }), _jsxs("p", { className: "text-xs text-muted", children: ["Next run: ", schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : 'N/A'] }), _jsx("div", { className: "flex justify-start md:justify-end", children: _jsxs(Button, { variant: "danger", className: "h-8 px-2 text-xs", onClick: () => deleteSchedule(schedule.id), children: [_jsx(Trash2, { size: 14 }), " Delete"] }) })] }, schedule.id))) })), _jsxs("form", { onSubmit: addSchedule, className: "space-y-2 rounded-xl border border-border bg-elevated/50 p-3", children: [_jsx("p", { className: "text-sm font-semibold text-text", children: "Create schedule" }), _jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsx(Input, { placeholder: "Schedule name", value: newSchedule.name, onChange: (event) => setNewSchedule({ ...newSchedule, name: event.target.value }) }), _jsx(Input, { placeholder: "Cron expression", value: newSchedule.cron_expr, onChange: (event) => setNewSchedule({ ...newSchedule, cron_expr: event.target.value }) }), _jsx(Input, { placeholder: "Timezone", value: newSchedule.timezone, onChange: (event) => setNewSchedule({ ...newSchedule, timezone: event.target.value }) })] }), _jsx(TextArea, { rows: 4, placeholder: 'Payload JSON, e.g. {"mode":"scheduled","search_config":{}}', value: newSchedule.payload, onChange: (event) => setNewSchedule({ ...newSchedule, payload: event.target.value }) }), _jsxs(Button, { type: "submit", disabled: busy, className: "h-8 px-2 text-xs", children: [_jsx(Plus, { size: 14 }), " Create Schedule"] })] })] })] }));
}
