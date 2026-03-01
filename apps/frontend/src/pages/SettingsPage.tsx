import { FormEvent, useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'

import { api, type LLMProviderSummary } from '../lib/api'
import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui'

const defaultProviderForm = {
  name: '',
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  api_key: '',
}

export function SettingsPage() {
  const [config, setConfig] = useState<any>({})
  const [credentials, setCredentials] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [providers, setProviders] = useState<LLMProviderSummary[]>([])
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [providerForm, setProviderForm] = useState({ ...defaultProviderForm })
  const [newCredential, setNewCredential] = useState({ domain: '', username: '', password: '' })
  const [newSchedule, setNewSchedule] = useState({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })

  const flashMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(null), 2500)
  }

  const resetProviderForm = () => {
    setEditingProviderId(null)
    setProviderForm({ ...defaultProviderForm })
  }

  const loadData = async () => {
    try {
      const [configRes, credentialsRes, schedulesRes, providersRes] = await Promise.all([
        api.getConfig(),
        api.listCredentials(),
        api.listSchedules(),
        api.listLLMProviders(),
      ])
      setConfig((configRes as any).value || {})
      setCredentials(credentialsRes.items || [])
      setSchedules(schedulesRes.items || [])
      setProviders(providersRes.items || [])
      setActiveProviderId(providersRes.active_provider_id ?? null)
    } catch (err: any) {
      setMessage(`Error loading settings: ${err.message}`)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const saveConfig = async (updates: Record<string, unknown>) => {
    setBusy(true)
    try {
      const nextValue = { ...config, ...updates }
      await api.putConfig(nextValue)
      setConfig(nextValue)
      flashMessage('Settings saved successfully')
    } catch (err: any) {
      setMessage(`Error saving settings: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const beginEditProvider = (provider: LLMProviderSummary) => {
    setEditingProviderId(provider.id)
    setProviderForm({
      name: provider.name,
      base_url: provider.base_url,
      model: provider.model,
      api_key: '',
    })
  }

  const saveProvider = async (event: FormEvent) => {
    event.preventDefault()
    const name = providerForm.name.trim()
    const baseUrl = providerForm.base_url.trim()
    const model = providerForm.model.trim()
    const apiKey = providerForm.api_key.trim()
    if (!name || !baseUrl || !model) {
      setMessage('Provider name, base URL, and model are required')
      return
    }

    const payload: Record<string, unknown> = {
      name,
      base_url: baseUrl,
      model,
    }
    if (apiKey) {
      payload.api_key = apiKey
    }

    setBusy(true)
    try {
      if (editingProviderId) {
        await api.updateLLMProvider(editingProviderId, payload)
        flashMessage('Provider updated successfully')
      } else {
        await api.createLLMProvider(payload)
        flashMessage('Provider created successfully')
      }
      resetProviderForm()
      await loadData()
    } catch (err: any) {
      setMessage(`Error saving provider: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const testProviderFromForm = async () => {
    const name = providerForm.name.trim()
    const baseUrl = providerForm.base_url.trim()
    const model = providerForm.model.trim()
    const apiKey = providerForm.api_key.trim()
    if (!name || !baseUrl || !model) {
      setMessage('Provider name, base URL, and model are required for test')
      return
    }
    if (!editingProviderId && !apiKey) {
      setMessage('API key is required to test an unsaved provider')
      return
    }

    const payload: Record<string, unknown> = {
      base_url: baseUrl,
      model,
    }
    if (editingProviderId) {
      payload.provider_id = editingProviderId
    }
    if (apiKey) {
      payload.api_key = apiKey
    }

    setBusy(true)
    try {
      const result = await api.testLLMProvider(payload)
      flashMessage((result as any).message || 'Provider test succeeded')
    } catch (err: any) {
      setMessage(`Provider test failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const testProviderById = async (providerId: string) => {
    setBusy(true)
    try {
      const result = await api.testLLMProvider({ provider_id: providerId })
      flashMessage((result as any).message || 'Provider test succeeded')
    } catch (err: any) {
      setMessage(`Provider test failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const activateProvider = async (providerId: string) => {
    setBusy(true)
    try {
      await api.activateLLMProvider(providerId)
      await loadData()
      flashMessage('Active provider updated')
    } catch (err: any) {
      setMessage(`Error setting active provider: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const removeProvider = async (provider: LLMProviderSummary) => {
    if (!window.confirm(`Delete LLM provider "${provider.name}"?`)) return
    setBusy(true)
    try {
      await api.deleteLLMProvider(provider.id)
      if (editingProviderId === provider.id) {
        resetProviderForm()
      }
      await loadData()
      flashMessage('Provider deleted successfully')
    } catch (err: any) {
      setMessage(`Error deleting provider: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const addCredential = async (event: FormEvent) => {
    event.preventDefault()
    if (!newCredential.domain || !newCredential.username || !newCredential.password) {
      setMessage('Please fill in all credential fields')
      return
    }

    setBusy(true)
    try {
      await api.storeCredential(newCredential)
      setNewCredential({ domain: '', username: '', password: '' })
      await loadData()
      flashMessage('Credential added successfully')
    } catch (err: any) {
      setMessage(`Error adding credential: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const deleteCredential = async (domain: string, username: string) => {
    if (!window.confirm(`Delete credential for ${username}@${domain}?`)) return

    setBusy(true)
    try {
      await api.deleteCredential(domain, username)
      await loadData()
      flashMessage('Credential deleted successfully')
    } catch (err: any) {
      setMessage(`Error deleting credential: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const addSchedule = async (event: FormEvent) => {
    event.preventDefault()
    if (!newSchedule.name || !newSchedule.cron_expr) {
      setMessage('Schedule name and cron expression are required')
      return
    }

    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(newSchedule.payload)
    } catch {
      setMessage('Invalid JSON in schedule payload')
      return
    }

    setBusy(true)
    try {
      await api.createSchedule({ ...newSchedule, payload })
      setNewSchedule({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })
      await loadData()
      flashMessage('Schedule created successfully')
    } catch (err: any) {
      setMessage(`Error creating schedule: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const deleteSchedule = async (id: string) => {
    if (!window.confirm('Delete this schedule?')) return

    setBusy(true)
    try {
      await api.deleteSchedule(id)
      await loadData()
      flashMessage('Schedule deleted successfully')
    } catch (err: any) {
      setMessage(`Error deleting schedule: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Configure LLM providers, ATS credentials, behavior flags, and scheduling."
        actions={<Badge tone={busy ? 'warning' : 'success'}>{busy ? 'Processing' : 'Ready'}</Badge>}
      />

      {message ? <Card variant="muted" className="border-accent/50 text-accent">{message}</Card> : null}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-text">LLM Providers (OpenAI-compatible)</h2>
          <Badge tone="info">{providers.length}</Badge>
        </div>

        <div className="space-y-1 text-xs text-muted">
          <p>Active provider is used for resume parsing and AI-powered features.</p>
          <p>Endpoint must support OpenAI Chat Completions.</p>
          <p>API keys are encrypted at rest.</p>
        </div>

        {providers.length === 0 ? (
          <p className="text-sm text-muted">No LLM providers configured yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_1.1fr_0.8fr_0.6fr_0.6fr_auto] gap-2 rounded-xl border border-border bg-elevated/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted md:grid">
              <span>Name</span>
              <span>Base URL</span>
              <span>Model</span>
              <span>Key</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {providers.map((provider) => (
              <div key={provider.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2 md:grid-cols-[1fr_1.1fr_0.8fr_0.6fr_0.6fr_auto] md:items-center">
                <div>
                  <p className="text-xs text-muted md:hidden">Name</p>
                  <p className="font-semibold text-text">{provider.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted md:hidden">Base URL</p>
                  <p className="truncate text-sm text-text">{provider.base_url}</p>
                </div>
                <div>
                  <p className="text-xs text-muted md:hidden">Model</p>
                  <p className="text-sm text-text">{provider.model}</p>
                </div>
                <div>
                  <p className="text-xs text-muted md:hidden">Key</p>
                  <p className="text-sm text-text">
                    {!provider.has_api_key ? 'Missing' : provider.key_source === 'vault' ? 'Vault' : 'Env fallback'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted md:hidden">Status</p>
                  <Badge tone={provider.id === activeProviderId ? 'success' : 'default'}>
                    {provider.id === activeProviderId ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="secondary"
                    className="h-8 px-2 text-xs"
                    onClick={() => testProviderById(provider.id)}
                  >
                    Test provider
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    onClick={() => beginEditProvider(provider)}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-xs"
                    disabled={provider.id === activeProviderId}
                    onClick={() => activateProvider(provider.id)}
                  >
                    <Check size={14} /> Set active
                  </Button>
                  <Button
                    variant="danger"
                    className="h-8 px-2 text-xs"
                    onClick={() => removeProvider(provider)}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={saveProvider} className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
          <p className="text-sm font-semibold text-text">
            {editingProviderId ? 'Edit provider' : 'Add provider'}
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Provider name"
              value={providerForm.name}
              onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })}
            />
            <Input
              placeholder="Base URL"
              value={providerForm.base_url}
              onChange={(event) => setProviderForm({ ...providerForm, base_url: event.target.value })}
            />
            <Input
              placeholder="Model"
              value={providerForm.model}
              onChange={(event) => setProviderForm({ ...providerForm, model: event.target.value })}
            />
            <Input
              type="password"
              placeholder="API key"
              value={providerForm.api_key}
              onChange={(event) => setProviderForm({ ...providerForm, api_key: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={testProviderFromForm}>
              Test provider
            </Button>
            <Button type="submit" disabled={busy} className="h-8 px-2 text-xs">
              <Plus size={14} /> Save provider
            </Button>
            {editingProviderId ? (
              <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={resetProviderForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-display text-xl text-text">Application Behavior</h2>

          <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <input
                type="checkbox"
                checked={config.auto_submit_enabled ?? true}
                onChange={(event) => {
                  const value = event.target.checked
                  setConfig({ ...config, auto_submit_enabled: value })
                  saveConfig({ auto_submit_enabled: value })
                }}
              />
              Auto-submit applications
            </label>
            <p className="text-xs text-muted">Immediately submit eligible forms without manual review.</p>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <input
                type="checkbox"
                checked={config.browser_headless ?? true}
                onChange={(event) => {
                  const value = event.target.checked
                  setConfig({ ...config, browser_headless: value })
                  saveConfig({ browser_headless: value })
                }}
              />
              Headless browser
            </label>
            <p className="text-xs text-muted">Disable only when visual debugging is necessary.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text">noVNC URL</label>
            <Input
              value={config.vnc_url ?? 'http://localhost:7900'}
              onChange={(event) => setConfig({ ...config, vnc_url: event.target.value })}
              onBlur={() => saveConfig({ vnc_url: config.vnc_url })}
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-text">ATS Credentials</h2>
            <Badge tone="info">{credentials.length}</Badge>
          </div>
          <p className="text-xs text-muted">
            Used for Greenhouse/Lever/Workday login. Not used for LLM providers.
          </p>

          {credentials.length === 0 ? (
            <p className="text-sm text-muted">No ATS credentials stored yet.</p>
          ) : (
            <div className="space-y-2">
              {credentials.map((credential, index) => (
                <div key={`${credential.domain}-${credential.username}-${index}`} className="flex items-center justify-between rounded-xl border border-border bg-elevated/60 px-3 py-2">
                  <div>
                    <p className="font-semibold text-text">{credential.domain}</p>
                    <p className="text-xs text-muted">{credential.username}</p>
                  </div>
                  <Button
                    variant="danger"
                    className="h-8 px-2 text-xs"
                    onClick={() => deleteCredential(credential.domain, credential.username)}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={addCredential} className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
            <p className="text-sm font-semibold text-text">Add credential</p>
            <Input
              placeholder="ATS domain (e.g. acme.greenhouse.io)"
              value={newCredential.domain}
              onChange={(event) => setNewCredential({ ...newCredential, domain: event.target.value })}
            />
            <Input
              placeholder="Login email or username"
              value={newCredential.username}
              onChange={(event) => setNewCredential({ ...newCredential, username: event.target.value })}
            />
            <Input
              type="password"
              placeholder="Password"
              value={newCredential.password}
              onChange={(event) => setNewCredential({ ...newCredential, password: event.target.value })}
            />
            <Button type="submit" disabled={busy} className="h-8 px-2 text-xs">
              <Plus size={14} /> Add Credential
            </Button>
          </form>
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-text">Scheduling</h2>
          <Badge tone="default">{schedules.length} schedules</Badge>
        </div>

        {schedules.length === 0 ? (
          <p className="text-sm text-muted">No schedules configured yet.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                <div>
                  <p className="font-semibold text-text">{schedule.name}</p>
                  <p className="text-xs text-muted">{schedule.cron_expr} ({schedule.timezone})</p>
                </div>
                <p className="text-xs text-muted">
                  Next run: {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : 'N/A'}
                </p>
                <div className="flex justify-start md:justify-end">
                  <Button variant="danger" className="h-8 px-2 text-xs" onClick={() => deleteSchedule(schedule.id)}>
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addSchedule} className="space-y-2 rounded-xl border border-border bg-elevated/50 p-3">
          <p className="text-sm font-semibold text-text">Create schedule</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Schedule name"
              value={newSchedule.name}
              onChange={(event) => setNewSchedule({ ...newSchedule, name: event.target.value })}
            />
            <Input
              placeholder="Cron expression"
              value={newSchedule.cron_expr}
              onChange={(event) => setNewSchedule({ ...newSchedule, cron_expr: event.target.value })}
            />
            <Input
              placeholder="Timezone"
              value={newSchedule.timezone}
              onChange={(event) => setNewSchedule({ ...newSchedule, timezone: event.target.value })}
            />
          </div>
          <TextArea
            rows={4}
            placeholder='Payload JSON, e.g. {"mode":"scheduled","search_config":{}}'
            value={newSchedule.payload}
            onChange={(event) => setNewSchedule({ ...newSchedule, payload: event.target.value })}
          />
          <Button type="submit" disabled={busy} className="h-8 px-2 text-xs">
            <Plus size={14} /> Create Schedule
          </Button>
        </form>
      </Card>
    </div>
  )
}
