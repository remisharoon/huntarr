import { FormEvent, useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'

import { api, type LLMProviderSummary } from '../lib/api'
import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui'
import type { Profile } from '../types'

const defaultProviderForm = {
  name: '',
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  api_key: '',
}

type JobSources = {
  remoteok: boolean
  weworkremotely: boolean
  brave_search: boolean
}

const defaultJobSources: JobSources = {
  remoteok: true,
  weworkremotely: true,
  brave_search: true,
}

function normalizeJobSources(source: unknown): JobSources {
  if (!source || typeof source !== 'object') {
    return { ...defaultJobSources }
  }
  const value = source as Record<string, unknown>
  return {
    remoteok: Boolean(value.remoteok),
    weworkremotely: Boolean(value.weworkremotely),
    brave_search: Boolean(value.brave_search),
  }
}

function normalizeProfileForSettings(profile: Profile | null): Profile | null {
  if (!profile) return null
  return {
    ...profile,
    full_name: profile.full_name || '',
    email: profile.email || '',
    years_experience: profile.years_experience ?? 0,
    summary: profile.summary || '',
    skills: profile.skills || [],
    experience: profile.experience || [],
    education: profile.education || [],
    awards: profile.awards || [],
    certifications: profile.certifications || [],
    projects: profile.projects || [],
    languages: profile.languages || [],
    links: profile.links || [],
    preferences: profile.preferences || {},
  }
}

export function SettingsPage() {
  const [config, setConfig] = useState<any>({})
  const [credentials, setCredentials] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [providers, setProviders] = useState<LLMProviderSummary[]>([])
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [jobSources, setJobSources] = useState<JobSources>({ ...defaultJobSources })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [providerForm, setProviderForm] = useState({ ...defaultProviderForm })
  const [newCredential, setNewCredential] = useState({ domain: '', username: '', password: '' })
  const [newSchedule, setNewSchedule] = useState({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState('openai/gpt-4o-mini')
  const [steelApiKey, setSteelApiKey] = useState('')
  const [steelProjectId, setSteelProjectId] = useState('')

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
      const [configRes, credentialsRes, schedulesRes, providersRes, profileRes] = await Promise.all([
        api.getConfig(),
        api.listCredentials(),
        api.listSchedules(),
        api.listLLMProviders(),
        api.getProfile(),
      ])
      setConfig((configRes as any).value || {})
      setCredentials(credentialsRes.items || [])
      setSchedules(schedulesRes.items || [])
      setProviders(providersRes.items || [])
      setActiveProviderId(providersRes.active_provider_id ?? null)
      const normalizedProfile = normalizeProfileForSettings(profileRes)
      setProfile(normalizedProfile)
      setJobSources(normalizeJobSources(profileRes.job_sources))

      try {
        const [openRouterCred, steelCred] = await Promise.all([
          api.getCredential('openrouter.ai', 'default'),
          api.getCredential('steel.dev', 'default'),
        ])
        setOpenRouterApiKey((openRouterCred as any)?.password || '')
        setSteelApiKey((steelCred as any)?.password || '')
      } catch {
        setOpenRouterApiKey('')
        setSteelApiKey('')
      }

      setOpenRouterModel((configRes as any)?.value?.openrouter_model || 'openai/gpt-4o-mini')
      setSteelProjectId((configRes as any)?.value?.steel_project_id || '')
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

  const updateJobSources = async (sources: JobSources) => {
    setBusy(true)
    try {
      if (!profile) {
        throw new Error('Profile not loaded yet')
      }
      const updatedProfile = { ...profile, job_sources: sources }
      await api.saveProfile(updatedProfile)
      setJobSources(sources)
      setProfile(updatedProfile)
      flashMessage('Job sources updated successfully')
    } catch (err: any) {
      setMessage(`Error updating job sources: ${err.message}`)
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

  const saveByokKeys = async () => {
    setBusy(true)
    try {
      if (openRouterApiKey.trim()) {
        await api.storeCredential({
          domain: 'openrouter.ai',
          username: 'default',
          password: openRouterApiKey.trim(),
          metadata: { provider: 'openrouter', byok: true },
        })
      }

      if (steelApiKey.trim()) {
        await api.storeCredential({
          domain: 'steel.dev',
          username: 'default',
          password: steelApiKey.trim(),
          metadata: { provider: 'steel', byok: true },
        })
      }

      await saveConfig({
        openrouter_model: openRouterModel.trim() || 'openai/gpt-4o-mini',
        steel_project_id: steelProjectId.trim(),
      })

      flashMessage('BYOK settings saved')
      await loadData()
    } catch (err: any) {
      setMessage(`Failed to save BYOK settings: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const testOpenRouterKey = async () => {
    if (!openRouterApiKey.trim()) {
      setMessage('OpenRouter API key is required')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openRouterModel.trim() || 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: 'Reply only with: ok' }],
          max_tokens: 8,
          temperature: 0,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `OpenRouter test failed (${response.status})`)
      }

      flashMessage('OpenRouter key test succeeded')
    } catch (err: any) {
      setMessage(`OpenRouter test failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const testSteelKey = async () => {
    if (!steelApiKey.trim()) {
      setMessage('Steel API key is required')
      return
    }

    setBusy(true)
    try {
      const result = await api.createSteelSession({
        api_key: steelApiKey.trim(),
        project_id: steelProjectId.trim() || undefined,
        metadata: { source: 'huntarr-settings-test' },
      })
      flashMessage((result as any).message || 'Steel key test succeeded')
    } catch (err: any) {
      setMessage(`Steel test failed: ${err.message}`)
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

      {message ? <Card variant="muted" className="border-blue-200 text-blue-700 dark:border-blue-900/50 dark:text-blue-300">{message}</Card> : null}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">BYOK Providers</h2>
          <Badge tone="info">OpenRouter + Steel.dev</Badge>
        </div>
        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <p>Bring your own keys. Huntarr does not ship with shared API keys.</p>
          <p>OpenRouter key is used directly from the browser for AI tasks.</p>
          <p>Steel key is used only when creating automation sessions.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">OpenRouter (BYOK)</p>
            <Input
              type="password"
              placeholder="OpenRouter API key"
              value={openRouterApiKey}
              onChange={(event) => setOpenRouterApiKey(event.target.value)}
            />
            <Input
              placeholder="Model (e.g. openai/gpt-4o-mini)"
              value={openRouterModel}
              onChange={(event) => setOpenRouterModel(event.target.value)}
            />
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={testOpenRouterKey}>
              Test OpenRouter Key
            </Button>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Steel.dev (BYOK)</p>
            <Input
              type="password"
              placeholder="Steel API key"
              value={steelApiKey}
              onChange={(event) => setSteelApiKey(event.target.value)}
            />
            <Input
              placeholder="Steel project ID (optional)"
              value={steelProjectId}
              onChange={(event) => setSteelProjectId(event.target.value)}
            />
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={testSteelKey}>
              Test Steel Key
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" disabled={busy} onClick={saveByokKeys} className="h-8 px-3 text-xs">
            Save BYOK Settings
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">LLM Providers (OpenAI-compatible)</h2>
          <Badge tone="info">{providers.length}</Badge>
        </div>

        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <p>Active provider is used for resume parsing and AI-powered features.</p>
          <p>Endpoint must support OpenAI Chat Completions.</p>
          <p>API keys are encrypted at rest.</p>
        </div>

        {providers.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No LLM providers configured yet.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_1.1fr_0.8fr_0.6fr_0.6fr_auto] gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400 md:grid">
              <span>Name</span>
              <span>Base URL</span>
              <span>Model</span>
              <span>Key</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {providers.map((provider) => (
              <div key={provider.id} className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/70 md:grid-cols-[1fr_1.1fr_0.8fr_0.6fr_0.6fr_auto] md:items-center">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 md:hidden">Name</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{provider.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 md:hidden">Base URL</p>
                  <p className="truncate text-sm text-gray-900 dark:text-gray-100">{provider.base_url}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 md:hidden">Model</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{provider.model}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 md:hidden">Key</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {!provider.has_api_key ? 'Missing' : provider.key_source === 'vault' ? 'Vault' : 'Env fallback'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 md:hidden">Status</p>
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

        <form onSubmit={saveProvider} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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

      <Card className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Job Sources</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Select which job sources to query when starting hunts. All sources run in parallel.</p>

        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={jobSources.remoteok}
                onChange={(event) => updateJobSources({ ...jobSources, remoteok: event.target.checked })}
                disabled={busy}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">RemoteOK</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">remoteok.com API - remote-focused jobs</p>
              </div>
            </div>
            <Badge tone="success">Ready</Badge>
          </label>

          <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={jobSources.weworkremotely}
                onChange={(event) => updateJobSources({ ...jobSources, weworkremotely: event.target.checked })}
                disabled={busy}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">WeWorkRemotely</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">weworkremotely.com - RSS feed scraping</p>
              </div>
            </div>
            <Badge tone="success">Ready</Badge>
          </label>

          <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={jobSources.brave_search}
                onChange={(event) => updateJobSources({ ...jobSources, brave_search: event.target.checked })}
                disabled={busy}
              />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Brave Search</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">ATS domains (Greenhouse, Lever, Workday)</p>
              </div>
            </div>
            <Badge tone="warning">Check API key</Badge>
          </label>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Application Behavior</h2>

          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
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
            <p className="text-xs text-gray-600 dark:text-gray-400">Immediately submit eligible forms without manual review.</p>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
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
            <p className="text-xs text-gray-600 dark:text-gray-400">Disable only when visual debugging is necessary.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Session URL</label>
            <Input
              value={config.session_url ?? ''}
              onChange={(event) => setConfig({ ...config, session_url: event.target.value })}
              onBlur={(event) => saveConfig({ session_url: event.target.value })}
            />
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">ATS Credentials</h2>
            <Badge tone="info">{credentials.length}</Badge>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Used for Greenhouse/Lever/Workday login. Not used for LLM providers.
          </p>

          {credentials.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No ATS credentials stored yet.</p>
          ) : (
            <div className="space-y-2">
              {credentials.map((credential, index) => (
                <div key={`${credential.domain}-${credential.username}-${index}`} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/70">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{credential.domain}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{credential.username}</p>
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

          <form onSubmit={addCredential} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add credential</p>
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
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Scheduling</h2>
            <Badge tone="default">{schedules.length} schedules</Badge>
          </div>

        {schedules.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No schedules configured yet.</p>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/70 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{schedule.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{schedule.cron_expr} ({schedule.timezone})</p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
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

        <form onSubmit={addSchedule} className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Create schedule</p>
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
