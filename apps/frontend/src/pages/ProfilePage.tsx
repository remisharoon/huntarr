import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui'

export function ProfilePage({ profile, onSave }: { profile: any; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState<any>(profile ?? {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(profile ?? {})
  }, [profile])

  const completeness = useMemo(() => {
    const checks = [
      Boolean(form.full_name),
      Boolean(form.email),
      Boolean(form.phone),
      Boolean(form.summary),
      Array.isArray(form.skills) ? form.skills.length > 0 : Boolean(form.skills),
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [form])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...form,
        skills: String(form.skills || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <PageHeader
        title="Profile"
        subtitle="Structured profile data used for applications, generated answers, and outbound submissions."
        actions={<Badge tone={completeness >= 80 ? 'success' : 'warning'}>{completeness}% complete</Badge>}
      />

      <Card className="space-y-4">
        <h2 className="font-display text-xl text-text">Identity</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Full name"
            value={form.full_name ?? ''}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          />
          <Input
            placeholder="Email"
            value={form.email ?? ''}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <Input
            placeholder="Phone"
            value={form.phone ?? ''}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <Input
            placeholder="LinkedIn URL"
            value={form.linkedin ?? ''}
            onChange={(event) => setForm({ ...form, linkedin: event.target.value })}
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-xl text-text">Professional Summary</h2>
        <Input
          placeholder="Skills (comma separated)"
          value={Array.isArray(form.skills) ? form.skills.join(', ') : form.skills ?? ''}
          onChange={(event) => setForm({ ...form, skills: event.target.value })}
        />
        <TextArea
          rows={7}
          placeholder="Summary used for answer generation and profile tailoring"
          value={form.summary ?? ''}
          onChange={(event) => setForm({ ...form, summary: event.target.value })}
        />
      </Card>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <Card className="inline-flex items-center gap-3 rounded-2xl border-border bg-surface/95 p-3 shadow-panel">
          <p className="text-xs text-muted">Changes are applied to profile API on save.</p>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </Card>
      </div>
    </form>
  )
}
