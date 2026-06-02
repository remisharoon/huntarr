import { FormEvent, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, Plus, Trash2 } from 'lucide-react'

import { api, formatApiError } from '../lib/api'
import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui'
import type { Profile } from '../types'

type JobSources = Record<string, boolean>

type JobSourceDefinition = {
  id: string
  label: string
  description: string
  defaultEnabled: boolean
  setup: 'ready' | 'credentials' | 'unavailable' | 'attribution'
}

const jobSourceDefinitions: JobSourceDefinition[] = [
  {
    id: 'remoteok',
    label: 'RemoteOK',
    description: 'remoteok.com feed for remote-first engineering roles',
    defaultEnabled: true,
    setup: 'attribution',
  },
  {
    id: 'weworkremotely',
    label: 'WeWorkRemotely',
    description: 'weworkremotely.com RSS feed',
    defaultEnabled: true,
    setup: 'ready',
  },
  {
    id: 'remotive',
    label: 'Remotive',
    description: 'remotive.com remote jobs API (attribution + conservative polling)',
    defaultEnabled: true,
    setup: 'attribution',
  },
  {
    id: 'themuse',
    label: 'The Muse',
    description: 'themuse.com public jobs API',
    defaultEnabled: true,
    setup: 'ready',
  },
  {
    id: 'arbeitnow',
    label: 'Arbeitnow',
    description: 'arbeitnow.com job board API (global + EU roles)',
    defaultEnabled: true,
    setup: 'ready',
  },
  {
    id: 'brave_search',
    label: 'Brave Search',
    description: 'ATS domain search (not available in current cloud build)',
    defaultEnabled: false,
    setup: 'unavailable',
  },
  {
    id: 'adzuna',
    label: 'Adzuna',
    description: 'adzuna.com jobs API (requires app_id + app_key)',
    defaultEnabled: false,
    setup: 'credentials',
  },
  {
    id: 'usajobs',
    label: 'USAJobs',
    description: 'data.usajobs.gov API (requires key + User-Agent)',
    defaultEnabled: false,
    setup: 'credentials',
  },
]

const defaultJobSources: JobSources = jobSourceDefinitions.reduce<JobSources>((acc, source) => {
  acc[source.id] = source.defaultEnabled
  return acc
}, {})

function normalizeJobSources(source: unknown): JobSources {
  const normalized = { ...defaultJobSources }
  if (!source || typeof source !== 'object') {
    return normalized
  }
  const value = source as Record<string, unknown>
  for (const [key, entry] of Object.entries(value)) {
    normalized[key] = Boolean(entry)
  }
  return normalized
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
  type MessageTone = 'info' | 'danger'

  const sourceBadge = (setup: JobSourceDefinition['setup']) => {
    switch (setup) {
      case 'ready':
        return { tone: 'success' as const, label: 'Ready' }
      case 'credentials':
        return { tone: 'warning' as const, label: 'Needs key' }
      case 'attribution':
        return { tone: 'warning' as const, label: 'Attribution' }
      case 'unavailable':
      default:
        return { tone: 'danger' as const, label: 'Unavailable' }
    }
  }

  const [config, setConfig] = useState<any>({})
  const [credentials, setCredentials] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [jobSources, setJobSources] = useState<JobSources>({ ...defaultJobSources })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<MessageTone>('info')

  const [newCredential, setNewCredential] = useState({ domain: '', username: '', password: '' })
  const [newSchedule, setNewSchedule] = useState({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [openRouterModel, setOpenRouterModel] = useState('google/gemini-2.0-flash-exp:free')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [steelApiKey, setSteelApiKey] = useState('')
  const [steelProjectId, setSteelProjectId] = useState('')
  const [adzunaAppId, setAdzunaAppId] = useState('')
  const [adzunaApiKey, setAdzunaApiKey] = useState('')
  const [usajobsApiKey, setUsajobsApiKey] = useState('')
  const [usajobsUserAgent, setUsajobsUserAgent] = useState('')

  // Collapsed state for config blocks
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    providerKeys: false,
    jobSources: false,
    applicationBehavior: false,
    atsCredentials: false,
    scheduling: false,
  })

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const flashMessage = (text: string) => {
    setMessageTone('info')
    setMessage(text)
    setTimeout(() => setMessage(null), 2500)
  }

  const showErrorMessage = (text: string) => {
    setMessageTone('danger')
    setMessage(text)
  }

  const loadData = async () => {
    try {
      const [configRes, credentialsRes, schedulesRes, profileRes] = await Promise.all([
        api.getConfig(),
        api.listCredentials(),
        api.listSchedules(),
        api.getProfile(),
      ])
      setConfig((configRes as any).value || {})
      setCredentials(credentialsRes.items || [])
      setSchedules(schedulesRes.items || [])
      const normalizedProfile = normalizeProfileForSettings(profileRes)
      setProfile(normalizedProfile)
      setJobSources(normalizeJobSources(profileRes.job_sources))

      const [openRouterCredRes, steelCredRes, adzunaCredRes, usajobsCredRes, geminiCredRes, groqCredRes] = await Promise.allSettled([
        api.getCredential('openrouter.ai', 'default'),
        api.getCredential('steel.dev', 'default'),
        api.getCredential('adzuna.com', 'default'),
        api.getCredential('usajobs.gov', 'default'),
        api.getCredential('generativelanguage.googleapis.com', 'default'),
        api.getCredential('api.groq.com', 'default'),
      ])

      const openRouterCred = openRouterCredRes.status === 'fulfilled' ? (openRouterCredRes.value as any) : null
      const steelCred = steelCredRes.status === 'fulfilled' ? (steelCredRes.value as any) : null
      const adzunaCred = adzunaCredRes.status === 'fulfilled' ? (adzunaCredRes.value as any) : null
      const usajobsCred = usajobsCredRes.status === 'fulfilled' ? (usajobsCredRes.value as any) : null
      const geminiCred = geminiCredRes.status === 'fulfilled' ? (geminiCredRes.value as any) : null
      const groqCred = groqCredRes.status === 'fulfilled' ? (groqCredRes.value as any) : null

      setOpenRouterApiKey(openRouterCred?.password || '')
      setGeminiApiKey(geminiCred?.password || '')
      setGroqApiKey(groqCred?.password || '')
      setSteelApiKey(steelCred?.password || '')
      setAdzunaApiKey(adzunaCred?.password || '')
      setAdzunaAppId(adzunaCred?.metadata?.app_id || '')
      setUsajobsApiKey(usajobsCred?.password || '')
      setUsajobsUserAgent(usajobsCred?.metadata?.user_agent || '')

      setOpenRouterModel((configRes as any)?.value?.openrouter_model || 'google/gemini-2.0-flash-exp:free')
      setSteelProjectId((configRes as any)?.value?.steel_project_id || '')
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Error loading settings'))
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
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Error saving settings'))
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
      showErrorMessage(formatApiError(err, 'Error updating job sources'))
    } finally {
      setBusy(false)
    }
  }

  const addCredential = async (event: FormEvent) => {
    event.preventDefault()
    if (!newCredential.domain || !newCredential.username || !newCredential.password) {
      showErrorMessage('Please fill in all credential fields')
      return
    }

    setBusy(true)
    try {
      await api.storeCredential(newCredential)
      setNewCredential({ domain: '', username: '', password: '' })
      await loadData()
      flashMessage('Credential added successfully')
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Error adding credential'))
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
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Error deleting credential'))
    } finally {
      setBusy(false)
    }
  }

  const addSchedule = async (event: FormEvent) => {
    event.preventDefault()
    if (!newSchedule.name || !newSchedule.cron_expr) {
      showErrorMessage('Schedule name and cron expression are required')
      return
    }

    let payload: Record<string, unknown> = {}
    try {
      payload = JSON.parse(newSchedule.payload)
    } catch {
      showErrorMessage('Invalid JSON in schedule payload')
      return
    }

    setBusy(true)
    try {
      await api.createSchedule({ ...newSchedule, payload })
      setNewSchedule({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })
      await loadData()
      flashMessage('Schedule created successfully')
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Error creating schedule'))
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
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Error deleting schedule'))
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

      if (geminiApiKey.trim()) {
        await api.storeCredential({
          domain: 'generativelanguage.googleapis.com',
          username: 'default',
          password: geminiApiKey.trim(),
          metadata: { provider: 'gemini', byok: true },
        })
      }

      if (groqApiKey.trim()) {
        await api.storeCredential({
          domain: 'api.groq.com',
          username: 'default',
          password: groqApiKey.trim(),
          metadata: { provider: 'groq', byok: true },
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

      if (adzunaApiKey.trim() || adzunaAppId.trim()) {
        if (!adzunaApiKey.trim() || !adzunaAppId.trim()) {
          throw new Error('Both Adzuna app key and app ID are required')
        }
        await api.storeCredential({
          domain: 'adzuna.com',
          username: 'default',
          password: adzunaApiKey.trim(),
          metadata: { provider: 'adzuna', app_id: adzunaAppId.trim() },
        })
      }

      if (usajobsApiKey.trim() || usajobsUserAgent.trim()) {
        if (!usajobsApiKey.trim() || !usajobsUserAgent.trim()) {
          throw new Error('Both USAJobs API key and User-Agent email are required')
        }
        await api.storeCredential({
          domain: 'usajobs.gov',
          username: 'default',
          password: usajobsApiKey.trim(),
          metadata: { provider: 'usajobs', user_agent: usajobsUserAgent.trim() },
        })
      }

      await saveConfig({
        openrouter_model: openRouterModel.trim() || 'google/gemini-2.0-flash-exp:free',
        steel_project_id: steelProjectId.trim(),
      })

      flashMessage('Provider settings saved')
      await loadData()
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Failed to save BYOK settings'))
    } finally {
      setBusy(false)
    }
  }

  const testOpenRouterKey = async () => {
    if (!openRouterApiKey.trim()) {
      showErrorMessage('OpenRouter API key is required')
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
          model: openRouterModel.trim() || 'google/gemini-2.0-flash-exp:free',
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
    } catch (error) {
      showErrorMessage(formatApiError(error, 'OpenRouter test failed'))
    } finally {
      setBusy(false)
    }
  }

  const testSteelKey = async () => {
    if (!steelApiKey.trim()) {
      showErrorMessage('Steel API key is required')
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
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Steel test failed'))
    } finally {
      setBusy(false)
    }
  }

  const testGeminiKey = async () => {
    if (!geminiApiKey.trim()) {
      showErrorMessage('Gemini API key is required')
      return
    }

    setBusy(true)
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey.trim()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Reply only with: ok' }] }],
          }),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Gemini test failed (${response.status})`)
      }

      flashMessage('Gemini key test succeeded')
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Gemini test failed'))
    } finally {
      setBusy(false)
    }
  }

  const testGroqKey = async () => {
    if (!groqApiKey.trim()) {
      showErrorMessage('Groq API key is required')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Reply only with: ok' }],
          max_tokens: 8,
          temperature: 0,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Groq test failed (${response.status})`)
      }

      flashMessage('Groq key test succeeded')
    } catch (error) {
      showErrorMessage(formatApiError(error, 'Groq test failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Configure BYOK keys, ATS credentials, behavior flags, and scheduling."
        actions={<Badge tone={busy ? 'warning' : 'success'}>{busy ? 'Processing' : 'Ready'}</Badge>}
      />

      {message ? (
        <Card
          variant="muted"
          className={
            messageTone === 'danger'
              ? 'border-red-200 text-red-700 dark:border-red-900/50 dark:text-red-300'
              : 'border-blue-200 text-blue-700 dark:border-blue-900/50 dark:text-blue-300'
          }
        >
          {message}
        </Card>
      ) : null}

      <Card className="space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('providerKeys')}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {collapsedSections.providerKeys ? (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Provider Keys</h2>
          </div>
          <Badge tone="info">BYOK</Badge>
        </button>
        
        {!collapsedSections.providerKeys && (
          <>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <p>Bring your own keys. Huntarr does not ship with shared API keys.</p>
              <p>OpenRouter, Gemini, and Groq can be used for AI tasks.</p>
              <p>Steel key powers automation. Adzuna/USAJobs keys unlock additional discovery sources.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Create OpenRouter API keys (opens in new tab)"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-100 dark:focus-visible:ring-offset-gray-950"
                >
                  OpenRouter (BYOK)
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <Input
                  type="password"
                  placeholder="OpenRouter API key"
                  value={openRouterApiKey}
                  onChange={(event) => setOpenRouterApiKey(event.target.value)}
                />
                <Input
                  placeholder="Model (e.g. google/gemini-2.0-flash-exp:free)"
                  value={openRouterModel}
                  onChange={(event) => setOpenRouterModel(event.target.value)}
                />
                <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={testOpenRouterKey}>
                  Test OpenRouter Key
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Create Gemini API keys (opens in new tab)"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-100 dark:focus-visible:ring-offset-gray-950"
                >
                  Google Gemini (BYOK)
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <Input
                  type="password"
                  placeholder="Gemini API key"
                  value={geminiApiKey}
                  onChange={(event) => setGeminiApiKey(event.target.value)}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">Stored as credential `generativelanguage.googleapis.com/default`.</p>
                <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={testGeminiKey}>
                  Test Gemini Key
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Create Groq API keys (opens in new tab)"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-100 dark:focus-visible:ring-offset-gray-950"
                >
                  Groq (BYOK)
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <Input
                  type="password"
                  placeholder="Groq API key"
                  value={groqApiKey}
                  onChange={(event) => setGroqApiKey(event.target.value)}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">Stored as credential `api.groq.com/default`.</p>
                <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={testGroqKey}>
                  Test Groq Key
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                <a
                  href="https://app.steel.dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Create Steel API keys (opens in new tab)"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-100 dark:focus-visible:ring-offset-gray-950"
                >
                  Steel.dev (BYOK)
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
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

              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Adzuna (Optional)</p>
                <Input
                  placeholder="Adzuna app ID"
                  value={adzunaAppId}
                  onChange={(event) => setAdzunaAppId(event.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Adzuna app key"
                  value={adzunaApiKey}
                  onChange={(event) => setAdzunaApiKey(event.target.value)}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">Stored as credential `adzuna.com/default`.</p>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">USAJobs (Optional)</p>
                <Input
                  placeholder="User-Agent email (required by USAJobs)"
                  value={usajobsUserAgent}
                  onChange={(event) => setUsajobsUserAgent(event.target.value)}
                />
                <Input
                  type="password"
                  placeholder="USAJobs API key"
                  value={usajobsApiKey}
                  onChange={(event) => setUsajobsApiKey(event.target.value)}
                />
                <p className="text-xs text-gray-600 dark:text-gray-400">Stored as credential `usajobs.gov/default`.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" disabled={busy} onClick={saveByokKeys} className="h-8 px-3 text-xs">
                Save Provider Settings
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className="space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('jobSources')}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {collapsedSections.jobSources ? (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Job Sources</h2>
          </div>
        </button>

        {!collapsedSections.jobSources && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">Select which job sources to query when starting hunts. All sources run in parallel.</p>

            <div className="space-y-2">
              {jobSourceDefinitions.map((source) => {
                const badge = sourceBadge(source.setup)
                return (
                  <label key={source.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(jobSources[source.id])}
                        onChange={(event) => updateJobSources({ ...jobSources, [source.id]: event.target.checked })}
                        disabled={busy}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{source.label}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{source.description}</p>
                      </div>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </label>
                )
              })}
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('applicationBehavior')}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {collapsedSections.applicationBehavior ? (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Application Behavior</h2>
            </div>
          </button>

          {!collapsedSections.applicationBehavior && (
            <>
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
            </>
          )}
        </Card>

        <Card className="space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('atsCredentials')}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {collapsedSections.atsCredentials ? (
                <ChevronRight className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">ATS Credentials</h2>
            </div>
            <Badge tone="info">{credentials.length}</Badge>
          </button>

          {!collapsedSections.atsCredentials && (
            <>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Used for Greenhouse/Lever/Workday login. Not used for OpenRouter or Steel BYOK keys.
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
            </>
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('scheduling')}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {collapsedSections.scheduling ? (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Scheduling</h2>
          </div>
          <Badge tone="default">{schedules.length} schedules</Badge>
        </button>

        {!collapsedSections.scheduling && (
          <>
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
          </>
        )}
      </Card>
    </div>
  )
}
