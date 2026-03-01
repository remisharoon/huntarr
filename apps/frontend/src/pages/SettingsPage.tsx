import { FormEvent, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

import { api } from '../lib/api'
import { Button, Card, Input, TextArea } from '../components/ui'

type SectionState = { [key: string]: boolean }

export function SettingsPage() {
  const [config, setConfig] = useState<any>({})
  const [credentials, setCredentials] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [expanded, setExpanded] = useState<SectionState>({
    api: true,
    behavior: false,
    schedules: false,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [newCredential, setNewCredential] = useState({ domain: '', username: '', password: '' })
  const [newSchedule, setNewSchedule] = useState({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })
  const [scheduleFormExpanded, setScheduleFormExpanded] = useState(false)

  const loadData = async () => {
    try {
      const [configRes, credentialsRes, schedulesRes] = await Promise.all([
        api.getConfig(),
        api.listCredentials(),
        api.listSchedules(),
      ])
      setConfig((configRes as any).value || {})
      setCredentials(credentialsRes.items || [])
      setSchedules(schedulesRes.items || [])
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
      await api.putConfig({ ...config, ...updates })
      setConfig({ ...config, ...updates })
      setMessage('Settings saved successfully')
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage(`Error saving settings: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const addCredential = async (e: FormEvent) => {
    e.preventDefault()
    if (!newCredential.domain || !newCredential.username || !newCredential.password) {
      setMessage('Please fill in all credential fields')
      return
    }
    setBusy(true)
    try {
      await api.storeCredential(newCredential)
      setNewCredential({ domain: '', username: '', password: '' })
      await loadData()
      setMessage('Credential added successfully')
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage(`Error adding credential: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const deleteCredential = async (domain: string, username: string) => {
    if (!confirm(`Are you sure you want to delete the credential for ${username}@${domain}?`)) return
    setBusy(true)
    try {
      await api.deleteCredential(domain, username)
      await loadData()
      setMessage('Credential deleted successfully')
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage(`Error deleting credential: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const addSchedule = async (e: FormEvent) => {
    e.preventDefault()
    if (!newSchedule.name || !newSchedule.cron_expr) {
      setMessage('Please fill in schedule name and cron expression')
      return
    }
    setBusy(true)
    try {
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(newSchedule.payload)
      } catch {
        setMessage('Invalid JSON in schedule payload')
        return
      }
      await api.createSchedule({ ...newSchedule, payload })
      setNewSchedule({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })
      setScheduleFormExpanded(false)
      await loadData()
      setMessage('Schedule created successfully')
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage(`Error creating schedule: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const deleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    setBusy(true)
    try {
      await api.deleteSchedule(id)
      await loadData()
      setMessage('Schedule deleted successfully')
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      setMessage(`Error deleting schedule: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-4">
      {message && <Card className="border-accent bg-accent/10 text-accent">{message}</Card>}

      <Card>
        <div className="flex cursor-pointer items-center justify-between" onClick={() => toggleSection('api')}>
          <h2 className="font-display text-xl">API Configuration</h2>
          {expanded.api ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expanded.api && (
          <div className="mt-4 space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold">Stored API Keys</h3>
              {credentials.length === 0 ? (
                <p className="text-sm text-muted">No API keys stored yet.</p>
              ) : (
                <div className="space-y-2">
                  {credentials.map((cred, idx) => (
                    <div key={`${cred.domain}-${cred.username}-${idx}`} className="flex items-center justify-between rounded-lg bg-white/50 p-3">
                      <div>
                        <p className="font-medium">{cred.domain}</p>
                        <p className="text-sm text-muted">{cred.username}</p>
                      </div>
                      <Button onClick={() => deleteCredential(cred.domain, cred.username)} variant="ghost" className="text-red-600 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={addCredential} className="space-y-2 rounded-lg bg-white/50 p-3">
                <Input
                  placeholder="Domain (e.g., openai.com, brave.com)"
                  value={newCredential.domain}
                  onChange={(e) => setNewCredential({ ...newCredential, domain: e.target.value })}
                />
                <Input
                  placeholder="Username (e.g., sk-*, api-key)"
                  value={newCredential.username}
                  onChange={(e) => setNewCredential({ ...newCredential, username: e.target.value })}
                />
                <Input
                  type="password"
                  placeholder="API Key / Password"
                  value={newCredential.password}
                  onChange={(e) => setNewCredential({ ...newCredential, password: e.target.value })}
                />
                <Button type="submit" disabled={busy}>
                  <Plus size={16} className="mr-1" />
                  Add Credential
                </Button>
              </form>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex cursor-pointer items-center justify-between" onClick={() => toggleSection('behavior')}>
          <h2 className="font-display text-xl">Application Behavior</h2>
          {expanded.behavior ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expanded.behavior && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">OpenAI Model</label>
              <Input
                value={config.openai_model ?? 'gpt-4o-mini'}
                onChange={(e) => setConfig({ ...config, openai_model: e.target.value })}
                onBlur={() => saveConfig({ openai_model: config.openai_model })}
              />
              <p className="text-xs text-muted">The OpenAI model to use for AI-powered features</p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.auto_submit_enabled ?? true}
                  onChange={(e) => {
                    const newValue = e.target.checked
                    setConfig({ ...config, auto_submit_enabled: newValue })
                    saveConfig({ auto_submit_enabled: newValue })
                  }}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Auto-Submit Enabled</span>
              </label>
              <p className="text-xs text-muted">Automatically submit applications without manual review</p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.browser_headless ?? true}
                  onChange={(e) => {
                    const newValue = e.target.checked
                    setConfig({ ...config, browser_headless: newValue })
                    saveConfig({ browser_headless: newValue })
                  }}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Headless Browser</span>
              </label>
              <p className="text-xs text-muted">Run browser in headless mode (no GUI)</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">VNC URL</label>
              <Input
                value={config.vnc_url ?? 'http://localhost:7900'}
                onChange={(e) => setConfig({ ...config, vnc_url: e.target.value })}
                onBlur={() => saveConfig({ vnc_url: config.vnc_url })}
              />
              <p className="text-xs text-muted">URL for noVNC manual intervention sessions</p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex cursor-pointer items-center justify-between" onClick={() => toggleSection('schedules')}>
          <h2 className="font-display text-xl">Scheduling</h2>
          {expanded.schedules ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
        {expanded.schedules && (
          <div className="mt-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Automated Job Hunting Schedules</h3>
                <Button onClick={() => setScheduleFormExpanded(!scheduleFormExpanded)} variant="ghost" className="text-sm">
                  <Plus size={16} className="mr-1" />
                  Add Schedule
                </Button>
              </div>
              {schedules.length === 0 ? (
                <p className="text-sm text-muted">No schedules configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between rounded-lg bg-white/50 p-3">
                      <div>
                        <p className="font-medium">{schedule.name}</p>
                        <p className="text-sm text-muted">
                          {schedule.cron_expr} ({schedule.timezone})
                        </p>
                        <p className="text-xs text-muted">
                          Next run: {schedule.next_run_at ? new Date(schedule.next_run_at).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                      <Button onClick={() => deleteSchedule(schedule.id)} variant="ghost" className="text-red-600 hover:bg-red-50">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {scheduleFormExpanded && (
                <form onSubmit={addSchedule} className="space-y-2 rounded-lg bg-white/50 p-3">
                  <Input
                    placeholder="Schedule name (e.g., Daily Morning Hunt)"
                    value={newSchedule.name}
                    onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                  />
                  <Input
                    placeholder="Cron expression (e.g., 0 9 * * *)"
                    value={newSchedule.cron_expr}
                    onChange={(e) => setNewSchedule({ ...newSchedule, cron_expr: e.target.value })}
                  />
                  <Input
                    placeholder="Timezone (e.g., UTC, America/New_York)"
                    value={newSchedule.timezone}
                    onChange={(e) => setNewSchedule({ ...newSchedule, timezone: e.target.value })}
                  />
                  <TextArea
                    rows={3}
                    placeholder='Schedule payload (JSON, e.g., {"mode": "scheduled", "search_config": {}})'
                    value={newSchedule.payload}
                    onChange={(e) => setNewSchedule({ ...newSchedule, payload: e.target.value })}
                  />
                  <Button type="submit" disabled={busy}>
                    Create Schedule
                  </Button>
                  <Button type="button" onClick={() => setScheduleFormExpanded(false)} variant="ghost">
                    Cancel
                  </Button>
                </form>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
