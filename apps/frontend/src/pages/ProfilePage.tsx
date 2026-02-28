import { FormEvent, useState } from 'react'
import { Button, Card, Input, TextArea } from '../components/ui'

export function ProfilePage({ profile, onSave }: { profile: any; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState<any>(profile ?? {})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await onSave({
      ...form,
      skills: String(form.skills || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    })
  }

  return (
    <Card>
      <form className="space-y-3" onSubmit={submit}>
        <h2 className="font-display text-xl">Profile & Rules</h2>
        <Input placeholder="Full name" value={form.full_name ?? ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <Input placeholder="Email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input placeholder="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Input
          placeholder="Skills (comma separated)"
          value={Array.isArray(form.skills) ? form.skills.join(', ') : form.skills ?? ''}
          onChange={(e) => setForm({ ...form, skills: e.target.value })}
        />
        <TextArea
          rows={6}
          placeholder="Summary"
          value={form.summary ?? ''}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
        />
        <Button type="submit">Save Profile</Button>
      </form>
    </Card>
  )
}
