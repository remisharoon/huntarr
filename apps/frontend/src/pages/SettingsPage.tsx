import { FormEvent, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { api } from '../lib/api'
import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui'

export function SettingsPage() {
  const [config, setConfig] = useState<any>({})
  const [credentials, setCredentials] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [newCredential, setNewCredential] = useState({ domain: '', username: '', password: '' })
  const [newSchedule, setNewSchedule] = useState({ name: '', cron_expr: '', timezone: 'UTC', payload: '{}' })

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
      const nextValue = { ...config, ...updates }
      await api.putConfig(nextValue)
      setConfig(nextValue)
      setMessage('Settings saved successfully')
      setTimeout(() => setMessage(null), 2500)
    } catch (err: any) {
      setMessage(`Error saving settings: ${err.message}`)
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
      setMessage('Credential added successfully')
      setTimeout(() => setMessage(null), 2500)
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
      setMessage('Credential deleted successfully')
      setTimeout(() => setMessage(null), 2500)
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
      setMessage('Schedule created successfully')
      setTimeout(() => setMessage(null), 2500)
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
      setMessage('Schedule deleted successfully')
      setTimeout(() => setMessage(null), 2500)
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
        subtitle="Provider credentials, behavior flags, and scheduling in one operational layout."
        actions={<Badge tone={busy ? 'warning' : 'success'}>{busy ? 'Processing' : 'Ready'}</Badge>}
      />

      {message ? <Card variant="muted" className="border-accent/50 text-accent">{message}</Card> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="font-display text-xl text-text">Application Behavior</h2>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text">OpenAI Model</label>
            <Input
              value={config.openai_model ?? 'gpt-4o-mini'}
              onChange={(event) => setConfig({ ...config, openai_model: event.target.value })}
              onBlur={() => saveConfig({ openai_model: config.openai_model })}
            />
          </div>

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
            <h2 className="font-display text-xl text-text">Stored Credentials</h2>
            <Badge tone="info">{credentials.length}</Badge>
          </div>

          {credentials.length === 0 ? (
            <p className="text-sm text-muted">No credentials stored yet.</p>
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
              placeholder="Domain (openai.com, brave.com)"
              value={newCredential.domain}
              onChange={(event) => setNewCredential({ ...newCredential, domain: event.target.value })}
            />
            <Input
              placeholder="Username or key id"
              value={newCredential.username}
              onChange={(event) => setNewCredential({ ...newCredential, username: event.target.value })}
            />
            <Input
              type="password"
              placeholder="Secret"
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
