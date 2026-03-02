import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Sparkles, Trash2, UploadCloud } from 'lucide-react'

import { Badge, Button, Card, Input, PageHeader, TextArea } from '../components/ui'
import { api } from '../lib/api'
import type {
  Profile,
  ProfileAward,
  ProfileCertification,
  ProfileEducation,
  ProfileExperience,
  ProfileLanguage,
  ProfileLink,
  ProfileProject,
} from '../types'

type ProfilePageProps = {
  profile: Profile | null
  onSave: (payload: Profile) => Promise<void>
}

type ListSectionKey = 'experience' | 'education' | 'awards' | 'certifications' | 'projects' | 'languages' | 'links'

const DEFAULT_PROFILE: Profile = {
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
}

const EMPTY_EXPERIENCE: ProfileExperience = { title: '', company: '', start: '', end: '', description: '' }
const EMPTY_EDUCATION: ProfileEducation = { degree: '', institution: '', year: '', description: '' }
const EMPTY_AWARD: ProfileAward = { title: '', issuer: '', year: '', description: '' }
const EMPTY_CERTIFICATION: ProfileCertification = { name: '', issuer: '', year: '', credential_id: '', url: '' }
const EMPTY_PROJECT: ProfileProject = { name: '', role: '', start: '', end: '', description: '', url: '', tech_stack: [] }
const EMPTY_LANGUAGE: ProfileLanguage = { name: '', proficiency: '' }
const EMPTY_LINK: ProfileLink = { label: '', url: '' }

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function asInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  const parsed = Number.parseInt(asString(value), 10)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item).trim())
      .filter(Boolean)
      .filter((item, index, array) => array.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index)
  }
  return asString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeProfile(input: Profile | Partial<Profile> | null | undefined): Profile {
  const source = (input ?? {}) as Partial<Profile>
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
    preferences: (source.preferences ?? {}) as Record<string, unknown>,
    rule_config: (source.rule_config ?? {}) as Record<string, unknown>,
    natural_language_override: source.natural_language_override ? asString(source.natural_language_override) : null,
  }
}

export function ProfilePage({ profile, onSave }: ProfilePageProps) {
  const [form, setForm] = useState<Profile>(normalizeProfile(profile))
  const [saving, setSaving] = useState(false)
  const [resumeStatus, setResumeStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [resumeFileName, setResumeFileName] = useState('')
  const [resumeError, setResumeError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasImportedRef = useRef(false)

  useEffect(() => {
    if (hasImportedRef.current) return
    setForm(normalizeProfile(profile))
  }, [profile])

  const completeness = useMemo(() => {
    const checks = [
      Boolean(form.full_name),
      Boolean(form.email),
      Boolean(form.phone),
      Boolean(form.summary),
      form.skills.length > 0,
      form.experience.length > 0,
      form.education.length > 0,
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [form])

  const handleResumeUpload = async (file: File) => {
    setResumeFileName(file.name)
    setResumeStatus('uploading')
    setResumeError('')
    try {
      const extracted = await api.importResume(file)
      hasImportedRef.current = true
      setForm((prev) => normalizeProfile({ ...prev, ...extracted }))
      setResumeStatus('done')
    } catch (err: any) {
      setResumeError(err?.message ?? 'Upload failed')
      setResumeStatus('error')
    }
  }

  const updateSectionItem = (key: ListSectionKey, index: number, item: unknown) => {
    setForm((prev) => {
      const current = [...(prev[key] as unknown[])]
      current[index] = item
      return normalizeProfile({ ...prev, [key]: current })
    })
  }

  const addSectionItem = (key: ListSectionKey) => {
    const emptyItemByKey: Record<ListSectionKey, unknown> = {
      experience: EMPTY_EXPERIENCE,
      education: EMPTY_EDUCATION,
      awards: EMPTY_AWARD,
      certifications: EMPTY_CERTIFICATION,
      projects: EMPTY_PROJECT,
      languages: EMPTY_LANGUAGE,
      links: EMPTY_LINK,
    }
    setForm((prev) => normalizeProfile({ ...prev, [key]: [...(prev[key] as unknown[]), emptyItemByKey[key]] }))
  }

  const removeSectionItem = (key: ListSectionKey, index: number) => {
    setForm((prev) => {
      const current = [...(prev[key] as unknown[])]
      current.splice(index, 1)
      return normalizeProfile({ ...prev, [key]: current })
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(normalizeProfile(form))
      hasImportedRef.current = false
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

      <Card className="space-y-3">
        <h2 className="font-display text-xl text-text">Resume Intelligence</h2>
        <p className="text-sm text-muted">Upload a PDF resume to auto-populate your profile, extract profile photo, and regenerate a professional summary.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleResumeUpload(file)
            e.target.value = ''
          }}
        />
        <div className="resume-upload-cta flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <Button
            type="button"
            variant="attention"
            className="resume-upload-button"
            disabled={resumeStatus === 'uploading'}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={16} />
            {resumeStatus === 'uploading' ? 'Parsing resume...' : 'Upload PDF Resume'}
          </Button>
          <Badge tone="info" className="gap-1">
            <Sparkles size={12} /> AI profile extraction
          </Badge>
          {resumeStatus === 'uploading' && <span className="text-sm text-muted">Extracting identity, experience, education, skills, achievements, and links...</span>}
          {resumeStatus === 'done' && <span className="text-sm text-success">Profile refreshed from {resumeFileName}</span>}
          {resumeStatus === 'error' && <span className="text-sm text-danger">{resumeError}</span>}
        </div>

        {form.profile_photo_path ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-elevated/50 p-3">
            <img
              src={api.profilePhotoUrl(form.profile_photo_path)}
              alt="Extracted profile"
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">Extracted profile photo ready for job applications</p>
              <p className="truncate text-xs text-muted">{form.profile_photo_path}</p>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-xl text-text">Identity</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            placeholder="Full name"
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          />
          <Input
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            placeholder="Phone"
            value={form.phone ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <Input
            placeholder="Location"
            value={form.location ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
          />
          <Input
            type="number"
            min={0}
            placeholder="Years of experience"
            value={String(form.years_experience ?? 0)}
            onChange={(event) => setForm((prev) => ({ ...prev, years_experience: asInt(event.target.value) }))}
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-xl text-text">Professional Summary</h2>
        <Input
          placeholder="Skills (comma separated)"
          value={form.skills.join(', ')}
          onChange={(event) => setForm((prev) => ({ ...prev, skills: asStringList(event.target.value) }))}
        />
        <TextArea
          rows={7}
          placeholder="Summary used for answer generation and profile tailoring"
          value={form.summary}
          onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
        />
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Experience</h2>
          <Button type="button" variant="secondary" onClick={() => addSectionItem('experience')}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {form.experience.length === 0 ? <p className="text-sm text-muted">No experience entries yet.</p> : null}
        {form.experience.map((item, index) => (
          <Card key={`exp-${index}`} variant="muted" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Title" value={item.title} onChange={(e) => updateSectionItem('experience', index, { ...item, title: e.target.value })} />
              <Input placeholder="Company" value={item.company} onChange={(e) => updateSectionItem('experience', index, { ...item, company: e.target.value })} />
              <Input placeholder="Start" value={item.start} onChange={(e) => updateSectionItem('experience', index, { ...item, start: e.target.value })} />
              <Input placeholder="End" value={item.end} onChange={(e) => updateSectionItem('experience', index, { ...item, end: e.target.value })} />
            </div>
            <TextArea rows={4} placeholder="Description" value={item.description} onChange={(e) => updateSectionItem('experience', index, { ...item, description: e.target.value })} />
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeSectionItem('experience', index)}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Education</h2>
          <Button type="button" variant="secondary" onClick={() => addSectionItem('education')}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {form.education.length === 0 ? <p className="text-sm text-muted">No education entries yet.</p> : null}
        {form.education.map((item, index) => (
          <Card key={`edu-${index}`} variant="muted" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Degree" value={item.degree} onChange={(e) => updateSectionItem('education', index, { ...item, degree: e.target.value })} />
              <Input placeholder="Institution" value={item.institution} onChange={(e) => updateSectionItem('education', index, { ...item, institution: e.target.value })} />
              <Input placeholder="Year" value={item.year} onChange={(e) => updateSectionItem('education', index, { ...item, year: e.target.value })} />
            </div>
            <TextArea rows={3} placeholder="Details" value={item.description} onChange={(e) => updateSectionItem('education', index, { ...item, description: e.target.value })} />
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeSectionItem('education', index)}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Projects</h2>
          <Button type="button" variant="secondary" onClick={() => addSectionItem('projects')}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {form.projects.length === 0 ? <p className="text-sm text-muted">No projects entries yet.</p> : null}
        {form.projects.map((item, index) => (
          <Card key={`proj-${index}`} variant="muted" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Project name" value={item.name} onChange={(e) => updateSectionItem('projects', index, { ...item, name: e.target.value })} />
              <Input placeholder="Role" value={item.role} onChange={(e) => updateSectionItem('projects', index, { ...item, role: e.target.value })} />
              <Input placeholder="Start" value={item.start} onChange={(e) => updateSectionItem('projects', index, { ...item, start: e.target.value })} />
              <Input placeholder="End" value={item.end} onChange={(e) => updateSectionItem('projects', index, { ...item, end: e.target.value })} />
              <Input placeholder="Project URL" value={item.url} onChange={(e) => updateSectionItem('projects', index, { ...item, url: e.target.value })} className="md:col-span-2" />
              <Input
                placeholder="Tech stack (comma separated)"
                value={item.tech_stack.join(', ')}
                onChange={(e) => updateSectionItem('projects', index, { ...item, tech_stack: asStringList(e.target.value) })}
                className="md:col-span-2"
              />
            </div>
            <TextArea rows={4} placeholder="Project description" value={item.description} onChange={(e) => updateSectionItem('projects', index, { ...item, description: e.target.value })} />
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeSectionItem('projects', index)}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Awards</h2>
          <Button type="button" variant="secondary" onClick={() => addSectionItem('awards')}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {form.awards.length === 0 ? <p className="text-sm text-muted">No award entries yet.</p> : null}
        {form.awards.map((item, index) => (
          <Card key={`award-${index}`} variant="muted" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Award title" value={item.title} onChange={(e) => updateSectionItem('awards', index, { ...item, title: e.target.value })} />
              <Input placeholder="Issuer" value={item.issuer} onChange={(e) => updateSectionItem('awards', index, { ...item, issuer: e.target.value })} />
              <Input placeholder="Year" value={item.year} onChange={(e) => updateSectionItem('awards', index, { ...item, year: e.target.value })} />
            </div>
            <TextArea rows={3} placeholder="Description" value={item.description} onChange={(e) => updateSectionItem('awards', index, { ...item, description: e.target.value })} />
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeSectionItem('awards', index)}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Certifications</h2>
          <Button type="button" variant="secondary" onClick={() => addSectionItem('certifications')}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {form.certifications.length === 0 ? <p className="text-sm text-muted">No certification entries yet.</p> : null}
        {form.certifications.map((item, index) => (
          <Card key={`cert-${index}`} variant="muted" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Certification" value={item.name} onChange={(e) => updateSectionItem('certifications', index, { ...item, name: e.target.value })} />
              <Input placeholder="Issuer" value={item.issuer} onChange={(e) => updateSectionItem('certifications', index, { ...item, issuer: e.target.value })} />
              <Input placeholder="Year" value={item.year} onChange={(e) => updateSectionItem('certifications', index, { ...item, year: e.target.value })} />
              <Input placeholder="Credential ID" value={item.credential_id} onChange={(e) => updateSectionItem('certifications', index, { ...item, credential_id: e.target.value })} />
              <Input placeholder="Credential URL" value={item.url} onChange={(e) => updateSectionItem('certifications', index, { ...item, url: e.target.value })} className="md:col-span-2" />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeSectionItem('certifications', index)}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Languages</h2>
          <Button type="button" variant="secondary" onClick={() => addSectionItem('languages')}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {form.languages.length === 0 ? <p className="text-sm text-muted">No language entries yet.</p> : null}
        {form.languages.map((item, index) => (
          <Card key={`lang-${index}`} variant="muted" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Language" value={item.name} onChange={(e) => updateSectionItem('languages', index, { ...item, name: e.target.value })} />
              <Input placeholder="Proficiency" value={item.proficiency} onChange={(e) => updateSectionItem('languages', index, { ...item, proficiency: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeSectionItem('languages', index)}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </Card>
        ))}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-text">Links</h2>
          <Button type="button" variant="secondary" onClick={() => addSectionItem('links')}>
            <Plus size={14} /> Add
          </Button>
        </div>
        {form.links.length === 0 ? <p className="text-sm text-muted">No link entries yet.</p> : null}
        {form.links.map((item, index) => (
          <Card key={`link-${index}`} variant="muted" className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Label" value={item.label} onChange={(e) => updateSectionItem('links', index, { ...item, label: e.target.value })} />
              <Input placeholder="URL" value={item.url} onChange={(e) => updateSectionItem('links', index, { ...item, url: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={() => removeSectionItem('links', index)}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
          </Card>
        ))}
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
