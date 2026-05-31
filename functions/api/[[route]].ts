import { neon } from '@neondatabase/serverless'
import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { createRemoteJWKSet, jwtVerify } from 'jose'

type Env = {
  NEON_DATABASE_URL?: string
  CLERK_JWKS_URL?: string
  CLERK_ISSUER?: string
}

type AppVariables = {
  userId: string
}

type StoredRow = {
  key: string
  value: unknown
  updated_at: string
}

type JsonObject = Record<string, unknown>

type RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed'

type RunMode = 'manual' | 'scheduled'

type RunRecord = {
  id: string
  mode: RunMode
  status: RunStatus
  current_node: string | null
  search_config: JsonObject
  state_json: JsonObject
  metrics: {
    discovered: number
    applied: number
    failed: number
    manual_required: number
    skipped: number
  }
  error: string | null
  started_at: string | null
  updated_at: string
  completed_at: string | null
}

type JobStatus = 'new' | 'queued' | 'applied'

type JobRecord = {
  id: string
  title: string
  company: string
  location: string
  source: string
  url: string | null
  score: number
  status: JobStatus
  description: string
  posted_at: string | null
  run_id: string | null
  last_run_id: string | null
  created_at: string
  updated_at: string
}

type ApplicationRecord = {
  id: string
  run_id: string | null
  job_id: string
  status: string
  source_portal: string | null
  error_code: string | null
  confirmation_text: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  answers: Array<{
    question: string
    answer: string
    confidence: number
    created_at: string
  }>
  generated_documents: Array<{
    id: string
    doc_type: string
    path: string
    created_at: string
  }>
  artifacts: JsonObject
}

type ManualActionRecord = {
  id: string
  run_id: string | null
  job_id: string | null
  company: string
  title: string
  action_type: string
  status: 'pending' | 'resolved' | 'blocked'
  session_url: string | null
  details: JsonObject
  created_at: string
  updated_at: string
}

type RunEventRecord = {
  id: string
  run_id: string
  level: 'info' | 'warning' | 'error'
  node: string | null
  event_type: string
  message: string
  payload_json: JsonObject | null
  created_at: string
}

type ProfileRecord = {
  id?: string
  full_name: string
  email: string
  phone?: string | null
  location?: string | null
  years_experience: number
  summary: string
  skills: string[]
  experience: unknown[]
  education: unknown[]
  awards: unknown[]
  certifications: unknown[]
  projects: unknown[]
  languages: unknown[]
  links: unknown[]
  profile_photo_path?: string | null
  profile_photo_mime?: string | null
  resume_path?: string | null
  preferences: JsonObject
  rule_config?: JsonObject
  natural_language_override?: string | null
  desired_job_title?: string | null
  desired_location?: string | null
  job_sources?: Record<string, boolean>
}

type CredentialRecord = {
  username: string
  password: string
  metadata: JsonObject
}

type NormalizedJobInput = {
  title: string
  company: string
  location: string
  source: string
  url: string | null
  description: string
  posted_at: string | null
  score?: number
}

type SourceFetchContext = {
  role: string
  location: string
  storage: Storage
  userId: string
}

type SourceFetchOutcome = {
  source: string
  jobs: NormalizedJobInput[]
  warnings: string[]
}

type HuntPreflightResponse = {
  can_start: boolean
  blockers: string[]
  warnings: string[]
  missing_profile_fields: string[]
  checked_at: string
}

type ScheduleRecord = {
  id: string
  name: string
  cron_expr: string
  timezone: string
  payload: JsonObject
  next_run_at: string | null
  created_at: string
  updated_at: string
}

const DEFAULT_USER_ID = 'anonymous'
const memoryStore = new Map<string, { value: unknown; updatedAt: string }>()

const JOB_SOURCE_CATALOG: ReadonlyArray<{ id: string; enabledByDefault: boolean }> = [
  { id: 'remoteok', enabledByDefault: true },
  { id: 'weworkremotely', enabledByDefault: true },
  { id: 'remotive', enabledByDefault: true },
  { id: 'themuse', enabledByDefault: true },
  { id: 'arbeitnow', enabledByDefault: true },
  { id: 'brave_search', enabledByDefault: false },
  { id: 'adzuna', enabledByDefault: false },
  { id: 'usajobs', enabledByDefault: false },
]

const DEFAULT_JOB_SOURCES = JOB_SOURCE_CATALOG.reduce<Record<string, boolean>>((acc, source) => {
  acc[source.id] = source.enabledByDefault
  return acc
}, {})

const KNOWN_SOURCE_IDS = new Set(JOB_SOURCE_CATALOG.map((source) => source.id))

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
)

function nowIso(): string {
  return new Date().toISOString()
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function userConfigKey(userId: string, key = 'default'): string {
  return `u:${userId}:cfg:${key.trim() || 'default'}`
}

function userCollectionPrefix(userId: string, collection: string): string {
  return `u:${userId}:col:${collection}:`
}

function userCollectionKey(userId: string, collection: string, id: string): string {
  return `${userCollectionPrefix(userId, collection)}${id}`
}

function userCredentialPrefix(userId: string): string {
  return `u:${userId}:cred:`
}

function userCredentialKey(userId: string, domain: string, username: string): string {
  return `${userCredentialPrefix(userId)}${encodeURIComponent(domain)}:${encodeURIComponent(username)}`
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

function createEventId(): string {
  const random = Math.floor(Math.random() * 1000)
  return String(Date.now() * 1000 + random)
}

const defaultProfile: ProfileRecord = {
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
  resume_path: null,
  preferences: {},
  rule_config: {},
  natural_language_override: null,
  desired_job_title: null,
  desired_location: null,
  job_sources: { ...DEFAULT_JOB_SOURCES },
}

const REQUIRED_PROFILE_FIELD_LABELS: Record<string, string> = {
  full_name: 'full name',
  email: 'email',
  phone: 'phone number',
  summary: 'professional summary',
  skills: 'skills',
  experience: 'experience',
  education: 'education',
}

class Storage {
  private sql: ReturnType<typeof neon> | null

  private ensuredSql = false

  public mode: 'memory' | 'neon'

  constructor(databaseUrl?: string) {
    if (databaseUrl && databaseUrl.trim()) {
      try {
        this.sql = neon(databaseUrl)
        this.mode = 'neon'
      } catch {
        this.sql = null
        this.mode = 'memory'
      }
    } else {
      this.sql = null
      this.mode = 'memory'
    }
  }

  private async ensureTable(): Promise<void> {
    if (!this.sql || this.ensuredSql) return
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS configs (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      this.ensuredSql = true
    } catch {
      this.sql = null
      this.mode = 'memory'
    }
  }

  async get(key: string): Promise<unknown | null> {
    if (this.sql) {
      await this.ensureTable()
      if (this.sql) {
        try {
          const rows = (await this.sql`
            SELECT value
            FROM configs
            WHERE key = ${key}
          `) as Array<{ value: unknown }>
          return rows[0]?.value ?? null
        } catch {
          this.sql = null
          this.mode = 'memory'
        }
      }
    }

    const record = memoryStore.get(key)
    return record ? record.value : null
  }

  async put(key: string, value: unknown): Promise<void> {
    const updatedAt = nowIso()
    if (this.sql) {
      await this.ensureTable()
      if (this.sql) {
        try {
          await this.sql`
            INSERT INTO configs(key, value)
            VALUES (${key}, ${JSON.stringify(value)}::jsonb)
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
          `
          return
        } catch {
          this.sql = null
          this.mode = 'memory'
        }
      }
    }

    memoryStore.set(key, { value, updatedAt })
  }

  async del(key: string): Promise<void> {
    if (this.sql) {
      await this.ensureTable()
      if (this.sql) {
        try {
          await this.sql`DELETE FROM configs WHERE key = ${key}`
          return
        } catch {
          this.sql = null
          this.mode = 'memory'
        }
      }
    }

    memoryStore.delete(key)
  }

  async list(prefix: string): Promise<StoredRow[]> {
    if (this.sql) {
      await this.ensureTable()
      if (this.sql) {
        try {
          const rows = (await this.sql`
            SELECT key, value, updated_at::text AS updated_at
            FROM configs
            WHERE key LIKE ${`${prefix}%`}
            ORDER BY updated_at DESC
          `) as StoredRow[]
          return rows
        } catch {
          this.sql = null
          this.mode = 'memory'
        }
      }
    }

    return [...memoryStore.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, row]) => ({
        key,
        value: row.value,
        updated_at: row.updatedAt,
      }))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
  }
}

function storageFor(c: { env: Env }): Storage {
  return new Storage(c.env.NEON_DATABASE_URL)
}

async function listCollection<T>(storage: Storage, userId: string, collection: string): Promise<T[]> {
  const rows = await storage.list(userCollectionPrefix(userId, collection))
  return rows.map((row) => row.value as T)
}

async function getCollectionItem<T>(storage: Storage, userId: string, collection: string, id: string): Promise<T | null> {
  return (await storage.get(userCollectionKey(userId, collection, id))) as T | null
}

async function putCollectionItem(storage: Storage, userId: string, collection: string, id: string, value: unknown): Promise<void> {
  await storage.put(userCollectionKey(userId, collection, id), value)
}

async function deleteCollectionItem(storage: Storage, userId: string, collection: string, id: string): Promise<void> {
  await storage.del(userCollectionKey(userId, collection, id))
}

async function appendRunEvent(
  storage: Storage,
  userId: string,
  runId: string,
  event: Omit<RunEventRecord, 'id' | 'run_id' | 'created_at'>,
): Promise<RunEventRecord> {
  const payload: RunEventRecord = {
    id: createEventId(),
    run_id: runId,
    created_at: nowIso(),
    level: event.level,
    node: event.node,
    event_type: event.event_type,
    message: event.message,
    payload_json: event.payload_json,
  }
  await putCollectionItem(storage, userId, 'run-event', payload.id, payload)
  return payload
}

async function listRunEvents(storage: Storage, userId: string, runId: string): Promise<RunEventRecord[]> {
  const items = await listCollection<RunEventRecord>(storage, userId, 'run-event')
  return items
    .filter((item) => item.run_id === runId)
    .sort((a, b) => Number(a.id) - Number(b.id))
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asString(item).trim())
    .filter(Boolean)
}

function mergeJobSources(...sources: Array<unknown>): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...DEFAULT_JOB_SOURCES }
  for (const source of sources) {
    const candidate = asObject(source)
    for (const [key, value] of Object.entries(candidate)) {
      merged[key] = Boolean(value)
    }
  }
  return merged
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function compactMessage(value: string, maxLength = 140): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 3)}...`
}

function isValidUrl(value: string): boolean {
  try {
    const candidate = new URL(value)
    return candidate.protocol === 'http:' || candidate.protocol === 'https:'
  } catch {
    return false
  }
}

function missingRequiredProfileFields(profile: JsonObject): string[] {
  const missing: string[] = []

  if (!asString(profile.full_name).trim()) {
    missing.push('full_name')
  }
  if (!asString(profile.email).trim()) {
    missing.push('email')
  }
  if (!asString(profile.phone).trim()) {
    missing.push('phone')
  }
  if (!asString(profile.summary).trim()) {
    missing.push('summary')
  }

  const skills = asStringArray(profile.skills)
  if (!skills.length) {
    missing.push('skills')
  }

  const experience = Array.isArray(profile.experience) ? profile.experience : []
  if (!experience.length) {
    missing.push('experience')
  }

  const education = Array.isArray(profile.education) ? profile.education : []
  if (!education.length) {
    missing.push('education')
  }

  return missing
}

async function probeUrl(
  url: string,
  init?: RequestInit,
  timeoutMs = 5000,
): Promise<{ reachable: boolean; status: number | null; error: string | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    return {
      reachable: true,
      status: response.status,
      error: null,
    }
  } catch (error) {
    return {
      reachable: false,
      status: null,
      error: error instanceof Error ? error.message : 'unknown error',
    }
  } finally {
    clearTimeout(timeout)
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function clampScore(value: number): number {
  return Math.min(0.99, Math.max(0.45, value))
}

function deterministicScore(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const scaled = (Math.abs(hash) % 48) / 100
  return clampScore(0.5 + scaled)
}

function canonicalUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    url.hash = ''
    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return null
  }
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const time = Date.parse(trimmed)
  if (Number.isNaN(time)) return null
  return new Date(time).toISOString()
}

function cdataText(value: string): string {
  return value.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, '$1').trim()
}

function getXmlTagValue(input: string, tag: string): string {
  const match = input.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'))
  return match ? cdataText(match[1]) : ''
}

function createNormalizedJob(source: string, fallbackLocation: string, input: Partial<NormalizedJobInput>): NormalizedJobInput | null {
  const title = asString(input.title).trim()
  if (!title) return null
  const company = asString(input.company, 'Unknown company').trim() || 'Unknown company'
  const location = asString(input.location, fallbackLocation).trim() || fallbackLocation
  const description = stripHtml(asString(input.description)).slice(0, 4000)
  const url = canonicalUrl(input.url ?? null)
  const postedAt = parseIsoDate(input.posted_at)
  const score = typeof input.score === 'number' && Number.isFinite(input.score)
    ? clampScore(input.score)
    : deterministicScore(`${source}|${title}|${company}|${location}`)

  return {
    title,
    company,
    location,
    source,
    url,
    description,
    posted_at: postedAt,
    score,
  }
}

function fingerprintForJob(input: { title: string; company: string; location: string; url: string | null }): string {
  const url = canonicalUrl(input.url)
  if (url) {
    return `u:${url}`
  }
  return `t:${normalizeText(input.title)}|c:${normalizeText(input.company)}|l:${normalizeText(input.location)}`
}

async function requestJson(url: string, init?: RequestInit, timeoutMs = 12000): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers(init?.headers ?? {})
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers,
    })
    if (!response.ok) {
      const text = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 240)
      throw new Error(text || `Request failed (${response.status})`)
    }
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function requestText(url: string, init?: RequestInit, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    if (!response.ok) {
      const text = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 240)
      throw new Error(text || `Request failed (${response.status})`)
    }
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function decodePdfLiteralString(literal: string): string {
  let output = ''
  for (let index = 0; index < literal.length; index += 1) {
    const char = literal[index]
    if (char !== '\\') {
      output += char
      continue
    }

    const next = literal[index + 1]
    if (!next) {
      break
    }

    if (next >= '0' && next <= '7') {
      let octal = next
      let offset = 2
      while (offset <= 3) {
        const candidate = literal[index + offset]
        if (!candidate || candidate < '0' || candidate > '7') break
        octal += candidate
        offset += 1
      }
      output += String.fromCharCode(Number.parseInt(octal, 8))
      index += octal.length
      continue
    }

    switch (next) {
      case 'n':
        output += '\n'
        break
      case 'r':
        output += '\r'
        break
      case 't':
        output += '\t'
        break
      case 'b':
        output += '\b'
        break
      case 'f':
        output += '\f'
        break
      case '(':
      case ')':
      case '\\':
        output += next
        break
      case '\n':
        break
      case '\r':
        if (literal[index + 2] === '\n') {
          index += 1
        }
        break
      default:
        output += next
        break
    }

    index += 1
  }
  return output
}

function cleanupExtractedPdfLine(value: string): string {
  const compact = value.replace(/[\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (compact.length < 2) return ''
  if (/^[^A-Za-z0-9]+$/.test(compact)) return ''
  return compact
}

function extractPdfStringsFromSource(source: string): string[] {
  const results: string[] = []
  const seen = new Set<string>()
  const literalRegex = /\((?:\\.|[^\\()]){2,}\)/g

  for (const match of source.matchAll(literalRegex)) {
    const raw = match[0]
    const decoded = cleanupExtractedPdfLine(decodePdfLiteralString(raw.slice(1, -1)))
    if (!decoded) continue
    const key = decoded.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(decoded)
    if (results.length >= 2500) {
      break
    }
  }

  return results
}

async function inflatePdfStreamChunk(stream: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null
  if (!stream.length) return null

  try {
    const decompressed = new Response(new Blob([stream]).stream().pipeThrough(new DecompressionStream('deflate')))
    return await decompressed.text()
  } catch {
    return null
  }
}

async function extractFlateDecodedPdfStrings(bytes: Uint8Array): Promise<string[]> {
  const source = new TextDecoder('latin1').decode(bytes)
  const chunks: string[] = []
  let cursor = 0

  while (cursor < source.length) {
    const streamIndex = source.indexOf('stream', cursor)
    if (streamIndex === -1) break
    const endstreamIndex = source.indexOf('endstream', streamIndex + 6)
    if (endstreamIndex === -1) break

    const header = source.slice(Math.max(0, streamIndex - 300), streamIndex)
    cursor = endstreamIndex + 'endstream'.length

    if (!/\/FlateDecode/.test(header)) {
      continue
    }

    let dataStart = streamIndex + 'stream'.length
    if (source[dataStart] === '\r' && source[dataStart + 1] === '\n') {
      dataStart += 2
    } else if (source[dataStart] === '\n' || source[dataStart] === '\r') {
      dataStart += 1
    }

    if (dataStart >= endstreamIndex) {
      continue
    }

    const rawChunk = bytes.slice(dataStart, endstreamIndex)
    const inflated = await inflatePdfStreamChunk(rawChunk)
    if (!inflated) {
      continue
    }

    chunks.push(...extractPdfStringsFromSource(inflated))
    if (chunks.length >= 4000) {
      break
    }
  }

  return chunks
}

async function extractResumeTextFromPdf(input: File): Promise<string> {
  const bytes = new Uint8Array(await input.arrayBuffer())
  const directSource = new TextDecoder('latin1').decode(bytes)
  const directStrings = extractPdfStringsFromSource(directSource)
  const inflatedStrings = await extractFlateDecodedPdfStrings(bytes)
  const allStrings = [...directStrings, ...inflatedStrings]

  const unique: string[] = []
  const seen = new Set<string>()
  for (const line of allStrings) {
    const normalized = cleanupExtractedPdfLine(line)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(normalized)
    if (unique.length >= 3500) {
      break
    }
  }

  return unique.join('\n').slice(0, 50000)
}

function extractJsonObjectFromModelOutput(content: string): JsonObject {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('AI response did not include content')
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed

  const parse = (value: string): JsonObject | null => {
    try {
      const parsed = JSON.parse(value)
      return asObject(parsed)
    } catch {
      return null
    }
  }

  const direct = parse(candidate)
  if (direct && Object.keys(direct).length) {
    return direct
  }

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const sliced = parse(candidate.slice(firstBrace, lastBrace + 1))
    if (sliced && Object.keys(sliced).length) {
      return sliced
    }
  }

  throw new Error('AI response was not valid JSON')
}

function sanitizeString(value: unknown, maxLen = 600): string {
  return asString(value).replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

function sanitizeStringList(value: unknown, maxItems = 40, maxLen = 80): string[] {
  const entries = Array.isArray(value)
    ? value
    : sanitizeString(value, 2000)
        .split(/[\n,]/)
        .map((item) => item.trim())

  const seen = new Set<string>()
  const output: string[] = []

  for (const entry of entries) {
    const normalized = sanitizeString(entry, maxLen)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(normalized)
    if (output.length >= maxItems) {
      break
    }
  }

  return output
}

function sanitizeProfileObjectArray(
  value: unknown,
  fields: Array<{ key: string; maxLen?: number }>,
  maxItems = 20,
): JsonObject[] {
  if (!Array.isArray(value)) return []
  const output: JsonObject[] = []

  for (const rawItem of value) {
    const item = asObject(rawItem)
    const next: JsonObject = {}
    for (const field of fields) {
      const fieldValue = sanitizeString(item[field.key], field.maxLen ?? 240)
      if (fieldValue) {
        next[field.key] = fieldValue
      }
    }

    if (Object.keys(next).length) {
      output.push(next)
    }
    if (output.length >= maxItems) {
      break
    }
  }

  return output
}

function sanitizeExtractedProfile(payload: JsonObject): Partial<ProfileRecord> {
  const result: Partial<ProfileRecord> = {}

  const fullName = sanitizeString(payload.full_name)
  if (fullName) result.full_name = fullName

  const email = sanitizeString(payload.email, 320)
  if (email) result.email = email

  const phone = sanitizeString(payload.phone, 80)
  if (phone) result.phone = phone

  const location = sanitizeString(payload.location, 180)
  if (location) result.location = location

  const summary = sanitizeString(payload.summary, 2400)
  if (summary) result.summary = summary

  const yearsExperience = Number.parseInt(asString(payload.years_experience), 10)
  if (Number.isFinite(yearsExperience) && yearsExperience >= 0) {
    result.years_experience = Math.min(50, yearsExperience)
  }

  const skills = sanitizeStringList(payload.skills, 50, 80)
  if (skills.length) result.skills = skills

  const experience = sanitizeProfileObjectArray(
    payload.experience,
    [
      { key: 'title', maxLen: 160 },
      { key: 'company', maxLen: 160 },
      { key: 'start', maxLen: 40 },
      { key: 'end', maxLen: 40 },
      { key: 'description', maxLen: 1200 },
    ],
    20,
  )
  if (experience.length) result.experience = experience

  const education = sanitizeProfileObjectArray(
    payload.education,
    [
      { key: 'degree', maxLen: 180 },
      { key: 'institution', maxLen: 180 },
      { key: 'year', maxLen: 40 },
      { key: 'description', maxLen: 800 },
    ],
    12,
  )
  if (education.length) result.education = education

  const awards = sanitizeProfileObjectArray(
    payload.awards,
    [
      { key: 'title', maxLen: 180 },
      { key: 'issuer', maxLen: 180 },
      { key: 'year', maxLen: 40 },
      { key: 'description', maxLen: 800 },
    ],
    15,
  )
  if (awards.length) result.awards = awards

  const certifications = sanitizeProfileObjectArray(
    payload.certifications,
    [
      { key: 'name', maxLen: 180 },
      { key: 'issuer', maxLen: 180 },
      { key: 'year', maxLen: 40 },
      { key: 'credential_id', maxLen: 160 },
      { key: 'url', maxLen: 320 },
    ],
    20,
  )
  if (certifications.length) result.certifications = certifications

  const projectsRaw = sanitizeProfileObjectArray(
    payload.projects,
    [
      { key: 'name', maxLen: 180 },
      { key: 'role', maxLen: 180 },
      { key: 'start', maxLen: 40 },
      { key: 'end', maxLen: 40 },
      { key: 'description', maxLen: 1200 },
      { key: 'url', maxLen: 320 },
    ],
    20,
  )
  if (projectsRaw.length) {
    const sourceProjects = Array.isArray(payload.projects) ? payload.projects : []
    result.projects = projectsRaw.map((project, index) => {
      const sourceProject = asObject(sourceProjects[index])
      const techStack = sanitizeStringList(sourceProject.tech_stack, 20, 60)
      return {
        ...project,
        tech_stack: techStack,
      }
    })
  }

  const languagesRaw = sanitizeProfileObjectArray(
    payload.languages,
    [
      { key: 'name', maxLen: 80 },
      { key: 'proficiency', maxLen: 80 },
    ],
    20,
  )
  if (languagesRaw.length) result.languages = languagesRaw

  const linksRaw = sanitizeProfileObjectArray(
    payload.links,
    [
      { key: 'label', maxLen: 80 },
      { key: 'url', maxLen: 320 },
    ],
    20,
  )
  if (linksRaw.length) result.links = linksRaw

  return result
}

function mergeExtractedProfile(current: JsonObject, extracted: Partial<ProfileRecord>, resumePath: string): ProfileRecord {
  const next: ProfileRecord = {
    ...defaultProfile,
    ...current,
    resume_path: resumePath,
  }

  const singleFields: Array<keyof Pick<ProfileRecord, 'full_name' | 'email' | 'phone' | 'location' | 'summary'>> = [
    'full_name',
    'email',
    'phone',
    'location',
    'summary',
  ]

  for (const field of singleFields) {
    const value = sanitizeString(extracted[field])
    if (value) {
      ;(next as any)[field] = value
    }
  }

  if (typeof extracted.years_experience === 'number' && Number.isFinite(extracted.years_experience)) {
    next.years_experience = Math.max(0, Math.min(50, Math.floor(extracted.years_experience)))
  }

  const listFields: Array<keyof Pick<ProfileRecord, 'skills' | 'experience' | 'education' | 'awards' | 'certifications' | 'projects' | 'languages' | 'links'>> = [
    'skills',
    'experience',
    'education',
    'awards',
    'certifications',
    'projects',
    'languages',
    'links',
  ]

  for (const field of listFields) {
    const value = extracted[field]
    if (Array.isArray(value) && value.length) {
      ;(next as any)[field] = value
    }
  }

  return next
}

async function extractProfileWithOpenRouter(apiKey: string, model: string, resumeText: string): Promise<Partial<ProfileRecord>> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract profile data from resumes. Return only valid JSON with keys: full_name, email, phone, location, years_experience, summary, skills, experience, education, awards, certifications, projects, languages, links. Use empty arrays for missing list sections and omit unknown scalar fields.',
        },
        {
          role: 'user',
          content: `Extract a structured profile from this resume text:\n\n${resumeText.slice(0, 32000)}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `OpenRouter extraction failed (${response.status})`)
  }

  const payload = asObject(await response.json())
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const firstChoice = asObject(choices[0])
  const message = asObject(firstChoice.message)
  const content = message.content

  let output = ''
  if (typeof content === 'string') {
    output = content
  } else if (Array.isArray(content)) {
    output = content
      .map((part) => (typeof part === 'string' ? part : sanitizeString(asObject(part).text, 4000)))
      .filter(Boolean)
      .join('\n')
  }

  const parsed = extractJsonObjectFromModelOutput(output)
  return sanitizeExtractedProfile(parsed)
}

async function readCredential(storage: Storage, userId: string, domain: string, username = 'default'): Promise<CredentialRecord | null> {
  const value = asObject(await storage.get(userCredentialKey(userId, domain, username)))
  const password = asString(value.password).trim()
  if (!password) return null
  return {
    username,
    password,
    metadata: asObject(value.metadata),
  }
}

async function buildHuntPreflight(
  storage: Storage,
  userId: string,
  options: { includeReachability: boolean } = { includeReachability: true },
): Promise<HuntPreflightResponse> {
  const blockers: string[] = []
  const warnings: string[] = []
  const seenWarnings = new Set<string>()
  const pushWarning = (message: string) => {
    const normalized = message.trim()
    if (!normalized || seenWarnings.has(normalized)) {
      return
    }
    seenWarnings.add(normalized)
    warnings.push(normalized)
  }

  const rawProfile = asObject(await storage.get(userConfigKey(userId, 'profile')))
  const profile: JsonObject = {
    ...defaultProfile,
    ...rawProfile,
    job_sources: mergeJobSources(defaultProfile.job_sources, rawProfile.job_sources),
  }

  const missingProfileFields = missingRequiredProfileFields(profile)
  if (missingProfileFields.length) {
    const labels = missingProfileFields.map((field) => REQUIRED_PROFILE_FIELD_LABELS[field] || field)
    blockers.push(`Profile is incomplete. Fill required fields: ${labels.join(', ')}.`)
  }

  const config = asObject(await storage.get(userConfigKey(userId, 'default')))
  const sessionUrl = asString(config.session_url).trim()
  if (sessionUrl) {
    if (!isValidUrl(sessionUrl)) {
      pushWarning('Session URL is invalid. Set a valid http(s) URL in Settings.')
    } else if (options.includeReachability) {
      const probe = await probeUrl(sessionUrl, undefined, 5000)
      if (!probe.reachable) {
        pushWarning(`Session URL is unreachable: ${compactMessage(probe.error || 'network error')}.`)
      } else if (probe.status && probe.status >= 400) {
        pushWarning(`Session URL returned HTTP ${probe.status}. Check that the URL is correct and reachable.`)
      }
    }
  }

  const openRouterCred = await readCredential(storage, userId, 'openrouter.ai')
  const openRouterApiKey = asString(openRouterCred?.password).trim()
  const openRouterModel = asString(config.openrouter_model).trim() || 'openrouter/free'

  if (!openRouterApiKey) {
    pushWarning('OpenRouter API key is not set. AI-powered features may fail.')
  }
  if (!openRouterModel) {
    pushWarning('OpenRouter model is missing. Set it in Settings.')
  }

  if (options.includeReachability && openRouterApiKey) {
    const probe = await probeUrl(
      'https://openrouter.ai/api/v1/models',
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${openRouterApiKey}`,
        },
      },
      6000,
    )

    if (!probe.reachable) {
      pushWarning(`OpenRouter endpoint is unreachable: ${compactMessage(probe.error || 'network error')}.`)
    } else if (probe.status === 401 || probe.status === 403) {
      pushWarning('OpenRouter API key appears invalid (unauthorized response).')
    } else if (probe.status && probe.status >= 500) {
      pushWarning(`OpenRouter endpoint returned HTTP ${probe.status}.`)
    } else if (probe.status && probe.status >= 400) {
      pushWarning(`OpenRouter endpoint returned HTTP ${probe.status}. Check your API key and model setting.`)
    }
  }

  const profileSources = mergeJobSources(defaultProfile.job_sources, profile.job_sources)
  const enabledSources = Object.entries(profileSources)
    .filter(([sourceId, enabled]) => Boolean(enabled) && KNOWN_SOURCE_IDS.has(sourceId))
    .map(([sourceId]) => sourceId)

  if (!enabledSources.length) {
    pushWarning('No job sources are enabled. Enable at least one source in Settings.')
  }

  if (enabledSources.includes('adzuna')) {
    const adzunaCred = await readCredential(storage, userId, 'adzuna.com')
    if (!adzunaCred) {
      pushWarning('Adzuna is enabled but app key is missing in Settings.')
    } else if (!asString(adzunaCred.metadata.app_id).trim()) {
      pushWarning('Adzuna is enabled but app ID metadata is missing in Settings.')
    }
  }

  if (enabledSources.includes('usajobs')) {
    const usajobsCred = await readCredential(storage, userId, 'usajobs.gov')
    if (!usajobsCred) {
      pushWarning('USAJobs is enabled but API key is missing in Settings.')
    } else if (!asString(usajobsCred.metadata.user_agent).trim()) {
      pushWarning('USAJobs is enabled but User-Agent metadata is missing in Settings.')
    }
  }

  const steelCred = await readCredential(storage, userId, 'steel.dev')
  if (!steelCred) {
    pushWarning('Steel API key is not set. Browser automation steps may fail.')
  } else if (options.includeReachability) {
    const probe = await probeUrl('https://api.steel.dev/v1/sessions', { method: 'OPTIONS' }, 5000)
    if (!probe.reachable) {
      pushWarning(`Steel API endpoint is unreachable: ${compactMessage(probe.error || 'network error')}.`)
    }
  }

  return {
    can_start: blockers.length === 0,
    blockers,
    warnings,
    missing_profile_fields: missingProfileFields,
    checked_at: nowIso(),
  }
}

async function fetchRemoteOkJobs(context: SourceFetchContext): Promise<SourceFetchOutcome> {
  const roleTags = context.role
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(',')

  const url = roleTags
    ? `https://remoteok.com/api?tags=${encodeURIComponent(roleTags)}`
    : 'https://remoteok.com/api'

  const payload = await requestJson(url)
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected Remote OK response payload')
  }

  const jobs = payload
    .slice(1)
    .map((entry) => asObject(entry))
    .map((entry) =>
      createNormalizedJob('remoteok', context.location, {
        title: asString(entry.position),
        company: asString(entry.company),
        location: asString(entry.location, 'Remote'),
        url: asString(entry.url) || asString(entry.apply_url),
        description: asString(entry.description),
        posted_at: asString(entry.date) || asString(entry.iso_date),
      }),
    )
    .filter((job): job is NormalizedJobInput => Boolean(job))
    .slice(0, 40)

  return { source: 'remoteok', jobs, warnings: [] }
}

async function fetchWeWorkRemotelyJobs(context: SourceFetchContext): Promise<SourceFetchOutcome> {
  const xml = await requestText('https://weworkremotely.com/remote-jobs.rss')
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => match[1])

  const jobs = items
    .map((item) => {
      const rawTitle = stripHtml(getXmlTagValue(item, 'title'))
      const [companyPart, titlePart] = rawTitle.split(/:\s+/, 2)
      return createNormalizedJob('weworkremotely', context.location, {
        title: titlePart || rawTitle,
        company: titlePart ? companyPart : 'WeWorkRemotely',
        location: context.location,
        url: getXmlTagValue(item, 'link'),
        description: getXmlTagValue(item, 'description'),
        posted_at: getXmlTagValue(item, 'pubDate'),
      })
    })
    .filter((job): job is NormalizedJobInput => Boolean(job))
    .slice(0, 40)

  return { source: 'weworkremotely', jobs, warnings: [] }
}

async function fetchRemotiveJobs(context: SourceFetchContext): Promise<SourceFetchOutcome> {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(context.role)}&limit=40`
  const payload = asObject(await requestJson(url))
  const rows = Array.isArray(payload.jobs) ? payload.jobs : []

  const jobs = rows
    .map((row) => asObject(row))
    .map((row) =>
      createNormalizedJob('remotive', context.location, {
        title: asString(row.title),
        company: asString(row.company_name),
        location: asString(row.candidate_required_location, 'Remote'),
        url: asString(row.url),
        description: asString(row.description),
        posted_at: asString(row.publication_date),
      }),
    )
    .filter((job): job is NormalizedJobInput => Boolean(job))
    .slice(0, 40)

  return {
    source: 'remotive',
    jobs,
    warnings: ['Remotive requires source attribution and conservative polling frequency.'],
  }
}

async function fetchTheMuseJobs(context: SourceFetchContext): Promise<SourceFetchOutcome> {
  const url = `https://www.themuse.com/api/public/jobs?page=1&descending=true&category=${encodeURIComponent(context.role)}`
  const payload = asObject(await requestJson(url))
  const rows = Array.isArray(payload.results) ? payload.results : []

  const jobs = rows
    .map((row) => asObject(row))
    .map((row) => {
      const company = asObject(row.company)
      const refs = asObject(row.refs)
      const locations = Array.isArray(row.locations) ? row.locations.map((item) => asObject(item)) : []
      return createNormalizedJob('themuse', context.location, {
        title: asString(row.name),
        company: asString(company.name),
        location: asString(locations[0]?.name, context.location),
        url: asString(refs.landing_page) || asString(refs.short_link),
        description: asString(row.contents),
        posted_at: asString(row.publication_date),
      })
    })
    .filter((job): job is NormalizedJobInput => Boolean(job))
    .slice(0, 30)

  return { source: 'themuse', jobs, warnings: [] }
}

async function fetchArbeitnowJobs(context: SourceFetchContext): Promise<SourceFetchOutcome> {
  const payload = asObject(await requestJson('https://www.arbeitnow.com/api/job-board-api'))
  const rows = Array.isArray(payload.data) ? payload.data : []

  const jobs = rows
    .map((row) => asObject(row))
    .map((row) =>
      createNormalizedJob('arbeitnow', context.location, {
        title: asString(row.title),
        company: asString(row.company_name),
        location: asString(row.location, context.location),
        url: asString(row.url),
        description: asString(row.description),
        posted_at: asString(row.created_at),
      }),
    )
    .filter((job): job is NormalizedJobInput => Boolean(job))
    .slice(0, 40)

  return { source: 'arbeitnow', jobs, warnings: [] }
}

async function fetchAdzunaJobs(context: SourceFetchContext): Promise<SourceFetchOutcome> {
  const credential = await readCredential(context.storage, context.userId, 'adzuna.com')
  if (!credential) {
    return { source: 'adzuna', jobs: [], warnings: ['Adzuna skipped: configure app key in Settings.'] }
  }

  const appId = asString(credential.metadata.app_id).trim()
  if (!appId) {
    return { source: 'adzuna', jobs: [], warnings: ['Adzuna skipped: missing app_id metadata in stored credential.'] }
  }

  const params = new URLSearchParams({
    app_id: appId,
    app_key: credential.password,
    what: context.role,
    results_per_page: '20',
    'content-type': 'application/json',
  })

  if (context.location.toLowerCase() !== 'remote') {
    params.set('where', context.location)
  }

  const payload = asObject(await requestJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params.toString()}`))
  const rows = Array.isArray(payload.results) ? payload.results : []

  const jobs = rows
    .map((row) => asObject(row))
    .map((row) => {
      const company = asObject(row.company)
      const location = asObject(row.location)
      return createNormalizedJob('adzuna', context.location, {
        title: asString(row.title),
        company: asString(company.display_name),
        location: asString(location.display_name, context.location),
        url: asString(row.redirect_url),
        description: asString(row.description),
        posted_at: asString(row.created),
      })
    })
    .filter((job): job is NormalizedJobInput => Boolean(job))

  return { source: 'adzuna', jobs, warnings: [] }
}

async function fetchUsaJobs(context: SourceFetchContext): Promise<SourceFetchOutcome> {
  const credential = await readCredential(context.storage, context.userId, 'usajobs.gov')
  if (!credential) {
    return { source: 'usajobs', jobs: [], warnings: ['USAJobs skipped: configure API key in Settings.'] }
  }

  const userAgent = asString(credential.metadata.user_agent).trim()
  if (!userAgent) {
    return { source: 'usajobs', jobs: [], warnings: ['USAJobs skipped: set required user_agent metadata in Settings.'] }
  }

  const params = new URLSearchParams({
    Keyword: context.role,
    ResultsPerPage: '20',
    Fields: 'Min',
  })

  if (context.location.toLowerCase() === 'remote') {
    params.set('RemoteIndicator', 'true')
  } else {
    params.set('LocationName', context.location)
  }

  const payload = asObject(
    await requestJson(`https://data.usajobs.gov/api/search?${params.toString()}`, {
      headers: {
        'Authorization-Key': credential.password,
        'User-Agent': userAgent,
      },
    }),
  )

  const searchResult = asObject(payload.SearchResult)
  const rows = Array.isArray(searchResult.SearchResultItems) ? searchResult.SearchResultItems : []

  const jobs = rows
    .map((row) => asObject(row))
    .map((row) => asObject(row.MatchedObjectDescriptor))
    .map((descriptor) => {
      const applyUris = asStringArray(descriptor.ApplyURI)
      return createNormalizedJob('usajobs', context.location, {
        title: asString(descriptor.PositionTitle),
        company: asString(descriptor.OrganizationName) || asString(descriptor.DepartmentName),
        location: asString(descriptor.PositionLocationDisplay, context.location),
        url: applyUris[0] || asString(descriptor.PositionURI),
        description: asString(descriptor.QualificationSummary),
        posted_at: asString(descriptor.PublicationStartDate),
      })
    })
    .filter((job): job is NormalizedJobInput => Boolean(job))

  return { source: 'usajobs', jobs, warnings: [] }
}

async function fetchBraveSearchJobs(): Promise<SourceFetchOutcome> {
  return {
    source: 'brave_search',
    jobs: [],
    warnings: ['Brave Search source is not available in this cloud build.'],
  }
}

const SOURCE_FETCHERS: Record<string, (context: SourceFetchContext) => Promise<SourceFetchOutcome>> = {
  remoteok: fetchRemoteOkJobs,
  weworkremotely: fetchWeWorkRemotelyJobs,
  remotive: fetchRemotiveJobs,
  themuse: fetchTheMuseJobs,
  arbeitnow: fetchArbeitnowJobs,
  brave_search: fetchBraveSearchJobs,
  adzuna: fetchAdzunaJobs,
  usajobs: fetchUsaJobs,
}

function pickEnabledSources(searchConfig: JsonObject, profileSources: Record<string, boolean>): string[] {
  const requested = asStringArray(searchConfig.sources).map((source) => source.toLowerCase())
  const enabledKnown = Object.entries(profileSources)
    .filter(([id, enabled]) => enabled && KNOWN_SOURCE_IDS.has(id))
    .map(([id]) => id)

  if (!requested.length) {
    return enabledKnown
  }

  return requested.filter((source) => KNOWN_SOURCE_IDS.has(source) && profileSources[source] !== false)
}

async function storeDiscoveredJobs(
  storage: Storage,
  userId: string,
  runId: string,
  jobs: NormalizedJobInput[],
): Promise<{ created: number; skipped: number }> {
  const existing = await listCollection<JobRecord>(storage, userId, 'job')
  const fingerprints = new Set(existing.map((job) => fingerprintForJob(job)))

  let created = 0
  let skipped = 0

  for (const job of jobs) {
    const fingerprint = fingerprintForJob(job)
    if (fingerprints.has(fingerprint)) {
      skipped += 1
      continue
    }

    fingerprints.add(fingerprint)
    const now = nowIso()
    const record: JobRecord = {
      id: createId('job'),
      title: job.title,
      company: job.company,
      location: job.location,
      source: job.source,
      url: job.url,
      score: typeof job.score === 'number' ? clampScore(job.score) : deterministicScore(fingerprint),
      status: 'new',
      description: job.description || 'No description available.',
      posted_at: job.posted_at,
      run_id: runId,
      last_run_id: runId,
      created_at: now,
      updated_at: now,
    }

    await putCollectionItem(storage, userId, 'job', record.id, record)
    created += 1
  }

  return { created, skipped }
}

function dedupeJobs(jobs: NormalizedJobInput[]): NormalizedJobInput[] {
  const deduped = new Map<string, NormalizedJobInput>()
  for (const job of jobs) {
    const key = fingerprintForJob(job)
    const existing = deduped.get(key)
    if (!existing || (job.score ?? 0) > (existing.score ?? 0)) {
      deduped.set(key, job)
    }
  }
  return [...deduped.values()]
}

app.use('/api/*', async (c, next) => {
  const path = c.req.path
  if (path === '/api/health') {
    c.set('userId', DEFAULT_USER_ID)
    await next()
    return
  }

  const jwksUrl = (c.env.CLERK_JWKS_URL ?? '').trim()
  const issuer = (c.env.CLERK_ISSUER ?? '').trim()
  const hasJwks = Boolean(jwksUrl)
  const hasIssuer = Boolean(issuer)

  if ((hasJwks && !hasIssuer) || (!hasJwks && hasIssuer)) {
    throw new HTTPException(500, {
      message: 'Clerk auth misconfigured: set both CLERK_JWKS_URL and CLERK_ISSUER',
    })
  }

  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!hasJwks && !hasIssuer) {
    c.set('userId', DEFAULT_USER_ID)
    await next()
    return
  }

  if (!token) {
    throw new HTTPException(401, { message: 'Missing bearer token' })
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(jwksUrl))
    const { payload } = await jwtVerify(token, JWKS, { issuer })
    const userId = asString(payload.sub)
    if (!userId) {
      throw new Error('Token payload missing subject')
    }
    c.set('userId', userId)
    await next()
  } catch (error) {
    throw new HTTPException(401, {
      message: `Invalid auth token: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
})

app.get('/api/health', async (c) => {
  const storage = storageFor(c)
  return c.json({
    status: 'ok',
    storage_mode: storage.mode,
    clerk_configured: Boolean((c.env.CLERK_JWKS_URL ?? '').trim() && (c.env.CLERK_ISSUER ?? '').trim()),
    timestamp: nowIso(),
  })
})

app.get('/api/config', async (c) => {
  const userId = c.get('userId')
  const key = (c.req.query('key') || 'default').trim() || 'default'
  const storage = storageFor(c)
  const value = asObject(await storage.get(userConfigKey(userId, key)))
  return c.json({ key, value })
})

app.put('/api/config', async (c) => {
  const userId = c.get('userId')
  const key = (c.req.query('key') || 'default').trim() || 'default'
  const body = await c.req.json<{ value?: JsonObject }>()
  const value = asObject(body?.value)
  const storage = storageFor(c)
  await storage.put(userConfigKey(userId, key), value)
  return c.json({ key, value })
})

app.get('/api/credentials', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const rows = await storage.list(userCredentialPrefix(userId))
  const items = rows.map((row) => {
    const suffix = row.key.replace(userCredentialPrefix(userId), '')
    const [encodedDomain, encodedUsername] = suffix.split(':')
    const value = asObject(row.value)
    return {
      domain: decodeURIComponent(encodedDomain || ''),
      username: decodeURIComponent(encodedUsername || ''),
      metadata: asObject(value.metadata),
      created_at: asString(value.updated_at, row.updated_at),
    }
  })
  return c.json({ items })
})

app.get('/api/credentials/:domain/:username', async (c) => {
  const userId = c.get('userId')
  const domain = c.req.param('domain')
  const username = c.req.param('username')
  const storage = storageFor(c)
  const value = asObject(await storage.get(userCredentialKey(userId, domain, username)))

  if (!Object.keys(value).length) {
    throw new HTTPException(404, { message: 'Credential not found' })
  }

  return c.json({
    domain,
    username,
    metadata: asObject(value.metadata),
    password: asString(value.password),
  })
})

app.post('/api/credentials', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    domain?: string
    username?: string
    password?: string
    metadata?: JsonObject
  }>()

  const domain = asString(body.domain).trim()
  const username = asString(body.username).trim()
  const password = asString(body.password).trim()

  if (!domain || !username || !password) {
    throw new HTTPException(400, { message: 'domain, username, and password are required' })
  }

  const storage = storageFor(c)
  await storage.put(userCredentialKey(userId, domain, username), {
    password,
    metadata: asObject(body.metadata),
    updated_at: nowIso(),
  })

  return c.json({ domain, username, metadata: asObject(body.metadata) })
})

app.delete('/api/credentials/:domain/:username', async (c) => {
  const userId = c.get('userId')
  const domain = c.req.param('domain')
  const username = c.req.param('username')
  const storage = storageFor(c)
  await storage.del(userCredentialKey(userId, domain, username))
  return c.json({ success: true })
})

app.get('/api/schedules', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const items = await listCollection<ScheduleRecord>(storage, userId, 'schedule')
  return c.json({ items })
})

app.post('/api/schedules', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    name?: string
    cron_expr?: string
    timezone?: string
    payload?: JsonObject
  }>()

  const name = asString(body.name).trim()
  const cronExpr = asString(body.cron_expr).trim()
  const timezone = asString(body.timezone, 'UTC').trim() || 'UTC'
  if (!name || !cronExpr) {
    throw new HTTPException(400, { message: 'name and cron_expr are required' })
  }

  const now = nowIso()
  const schedule: ScheduleRecord = {
    id: createId('sched'),
    name,
    cron_expr: cronExpr,
    timezone,
    payload: asObject(body.payload),
    next_run_at: null,
    created_at: now,
    updated_at: now,
  }

  const storage = storageFor(c)
  await putCollectionItem(storage, userId, 'schedule', schedule.id, schedule)
  return c.json(schedule, 201)
})

app.delete('/api/schedules/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const storage = storageFor(c)
  await deleteCollectionItem(storage, userId, 'schedule', id)
  return c.json({ success: true })
})

app.get('/api/profile', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const existing = asObject(await storage.get(userConfigKey(userId, 'profile')))
  if (!Object.keys(existing).length) {
    await storage.put(userConfigKey(userId, 'profile'), defaultProfile)
    return c.json(defaultProfile)
  }
  return c.json({
    ...defaultProfile,
    ...existing,
    job_sources: mergeJobSources(defaultProfile.job_sources, existing.job_sources),
  })
})

app.put('/api/profile', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<Partial<ProfileRecord>>()
  const storage = storageFor(c)
  const current = asObject(await storage.get(userConfigKey(userId, 'profile')))
  const incoming = asObject(body)
  const next = {
    ...defaultProfile,
    ...current,
    ...incoming,
    job_sources: mergeJobSources(defaultProfile.job_sources, current.job_sources, incoming.job_sources),
  }
  await storage.put(userConfigKey(userId, 'profile'), next)
  return c.json(next)
})

app.post('/api/profile/import-resume', async (c) => {
  const userId = c.get('userId')
  const formData = await c.req.formData()
  const input = formData.get('file')
  if (!(input instanceof File)) {
    throw new HTTPException(400, { message: 'file is required' })
  }

  if (!/\.pdf$/i.test(input.name)) {
    throw new HTTPException(400, { message: 'Only PDF files are supported for AI profile extraction' })
  }

  const filename = input.name || 'resume'
  const storage = storageFor(c)
  const config = asObject(await storage.get(userConfigKey(userId, 'default')))
  const openRouterModel = asString(config.openrouter_model).trim() || 'openrouter/free'
  const openRouterCred = await readCredential(storage, userId, 'openrouter.ai')
  const openRouterApiKey = asString(openRouterCred?.password).trim()

  if (!openRouterApiKey) {
    throw new HTTPException(400, { message: 'OpenRouter API key is not configured. Add it in Settings > Provider Keys.' })
  }

  const resumeText = await extractResumeTextFromPdf(input)
  if (!resumeText || resumeText.length < 80) {
    throw new HTTPException(400, {
      message: 'Could not extract readable text from this PDF. Try a text-based PDF export.',
    })
  }

  let extracted: Partial<ProfileRecord>
  try {
    extracted = await extractProfileWithOpenRouter(openRouterApiKey, openRouterModel, resumeText)
  } catch (error) {
    throw new HTTPException(502, {
      message: `AI profile extraction failed: ${compactMessage(error instanceof Error ? error.message : 'unknown error', 220)}`,
    })
  }

  if (!Object.keys(extracted).length) {
    throw new HTTPException(502, { message: 'AI profile extraction returned no usable fields' })
  }

  const resumePath = `uploads/${createId('resume')}-${filename}`

  const current = asObject(await storage.get(userConfigKey(userId, 'profile')))
  const next = mergeExtractedProfile(current, extracted, resumePath)
  await storage.put(userConfigKey(userId, 'profile'), next)

  return c.json({
    ...extracted,
    resume_path: resumePath,
  })
})

app.get('/api/profile/photo', (c) => {
  throw new HTTPException(404, { message: 'Profile photo storage is not configured' })
})

app.get('/api/runs', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const items = await listCollection<RunRecord>(storage, userId, 'run')
  return c.json({
    items: items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0)),
  })
})

app.get('/api/runs/preflight', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const preflight = await buildHuntPreflight(storage, userId, { includeReachability: true })
  return c.json(preflight)
})

app.get('/api/runs/:id', async (c) => {
  const userId = c.get('userId')
  const runId = c.req.param('id')
  const storage = storageFor(c)
  const run = await getCollectionItem<RunRecord>(storage, userId, 'run', runId)
  if (!run) {
    throw new HTTPException(404, { message: 'Run not found' })
  }
  return c.json(run)
})

app.post('/api/runs', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const preflight = await buildHuntPreflight(storage, userId, { includeReachability: false })
  if (!preflight.can_start) {
    throw new HTTPException(400, {
      message: preflight.blockers.join(' '),
    })
  }

  const body = await c.req.json<{ mode?: RunMode; search_config?: JsonObject }>()
  const now = nowIso()
  const run: RunRecord = {
    id: createId('run'),
    mode: body.mode === 'scheduled' ? 'scheduled' : 'manual',
    status: 'running',
    current_node: 'discovery',
    search_config: asObject(body.search_config),
    state_json: {},
    metrics: {
      discovered: 0,
      applied: 0,
      failed: 0,
      manual_required: 0,
      skipped: 0,
    },
    error: null,
    started_at: now,
    updated_at: now,
    completed_at: null,
  }

  await putCollectionItem(storage, userId, 'run', run.id, run)

  await appendRunEvent(storage, userId, run.id, {
    level: 'info',
    node: 'orchestrator',
    event_type: 'run_created',
    message: 'Run created from dashboard',
    payload_json: { mode: run.mode },
  })

  const roleKeywords = Array.isArray(run.search_config.role_keywords)
    ? (run.search_config.role_keywords as unknown[])
    : []
  const role = asString(roleKeywords[0], 'Software Engineer')

  const location = asString((run.search_config.locations as unknown[] | undefined)?.[0], 'Remote')
  const profile = asObject(await storage.get(userConfigKey(userId, 'profile')))
  const profileSources = mergeJobSources(defaultProfile.job_sources, profile.job_sources)
  const enabledSources = pickEnabledSources(run.search_config, profileSources)
  const maxJobsPerRun = Math.max(1, Math.min(200, Math.round(asNumber(run.search_config.max_jobs_per_run, 80))))

  await appendRunEvent(storage, userId, run.id, {
    level: 'info',
    node: 'discovery',
    event_type: 'source_selection',
    message: enabledSources.length
      ? `Running discovery across ${enabledSources.length} source(s)`
      : 'No enabled sources selected; discovery will use fallback seed.',
    payload_json: { sources: enabledSources, role, location },
  })

  const sourceContext: SourceFetchContext = {
    role,
    location,
    storage,
    userId,
  }

  const sourceResults = await Promise.allSettled(
    enabledSources.map(async (sourceId) => {
      const fetcher = SOURCE_FETCHERS[sourceId]
      if (!fetcher) {
        throw new Error(`Source '${sourceId}' is not implemented`)
      }
      return await fetcher(sourceContext)
    }),
  )

  const fetchedJobs: NormalizedJobInput[] = []
  let failedSources = 0

  for (let index = 0; index < sourceResults.length; index += 1) {
    const sourceId = enabledSources[index]
    const result = sourceResults[index]
    if (result.status === 'fulfilled') {
      fetchedJobs.push(...result.value.jobs)
      await appendRunEvent(storage, userId, run.id, {
        level: 'info',
        node: 'discovery',
        event_type: 'source_fetched',
        message: `${sourceId}: fetched ${result.value.jobs.length} jobs`,
        payload_json: { source: sourceId, discovered: result.value.jobs.length },
      })

      for (const warning of result.value.warnings) {
        await appendRunEvent(storage, userId, run.id, {
          level: 'warning',
          node: 'discovery',
          event_type: 'source_warning',
          message: `${sourceId}: ${warning}`,
          payload_json: { source: sourceId },
        })
      }
      continue
    }

    failedSources += 1
    await appendRunEvent(storage, userId, run.id, {
      level: 'warning',
      node: 'discovery',
      event_type: 'source_failed',
      message: `${sourceId}: ${result.reason instanceof Error ? result.reason.message : 'unknown source error'}`,
      payload_json: { source: sourceId },
    })
  }

  const deduped = dedupeJobs(fetchedJobs).slice(0, maxJobsPerRun)
  const persisted = await storeDiscoveredJobs(storage, userId, run.id, deduped)

  if (persisted.created === 0) {
    const seededJob: JobRecord = {
      id: createId('job'),
      title: role,
      company: 'Example Labs',
      location,
      source: 'manual_seed',
      url: 'https://example.com/jobs',
      score: 0.72,
      status: 'new',
      description: 'No live jobs were discovered. This seeded job keeps the run visible in the dashboard.',
      posted_at: now,
      run_id: run.id,
      last_run_id: run.id,
      created_at: now,
      updated_at: now,
    }
    await putCollectionItem(storage, userId, 'job', seededJob.id, seededJob)
    persisted.created = 1

    await appendRunEvent(storage, userId, run.id, {
      level: 'warning',
      node: 'discovery',
      event_type: 'seed_fallback',
      message: 'No external jobs were stored; inserted a fallback seeded job.',
      payload_json: { role, location },
    })
  }

  const nextRun: RunRecord = {
    ...run,
    metrics: {
      ...run.metrics,
      discovered: persisted.created,
      failed: failedSources,
      skipped: persisted.skipped,
    },
    error: failedSources === enabledSources.length && enabledSources.length > 0
      ? 'All enabled job sources failed; using fallback results.'
      : null,
    updated_at: nowIso(),
  }

  await putCollectionItem(storage, userId, 'run', run.id, nextRun)

  await appendRunEvent(storage, userId, run.id, {
    level: 'info',
    node: 'discovery',
    event_type: 'discovery_complete',
    message: `Stored ${persisted.created} jobs (${persisted.skipped} skipped duplicates).`,
    payload_json: {
      sources: enabledSources,
      discovered: persisted.created,
      skipped: persisted.skipped,
      failed_sources: failedSources,
    },
  })

  return c.json(nextRun, 201)
})

app.post('/api/runs/:id/pause', async (c) => {
  const userId = c.get('userId')
  const runId = c.req.param('id')
  const storage = storageFor(c)
  const run = await getCollectionItem<RunRecord>(storage, userId, 'run', runId)
  if (!run) {
    throw new HTTPException(404, { message: 'Run not found' })
  }

  const next: RunRecord = {
    ...run,
    status: 'paused',
    current_node: 'paused',
    updated_at: nowIso(),
  }
  await putCollectionItem(storage, userId, 'run', runId, next)

  await appendRunEvent(storage, userId, runId, {
    level: 'warning',
    node: 'orchestrator',
    event_type: 'run_paused',
    message: 'Run paused from UI',
    payload_json: null,
  })

  return c.json(next)
})

app.post('/api/runs/:id/resume', async (c) => {
  const userId = c.get('userId')
  const runId = c.req.param('id')
  const storage = storageFor(c)
  const run = await getCollectionItem<RunRecord>(storage, userId, 'run', runId)
  if (!run) {
    throw new HTTPException(404, { message: 'Run not found' })
  }

  const next: RunRecord = {
    ...run,
    status: 'running',
    current_node: 'discovery',
    updated_at: nowIso(),
  }
  await putCollectionItem(storage, userId, 'run', runId, next)

  await appendRunEvent(storage, userId, runId, {
    level: 'info',
    node: 'orchestrator',
    event_type: 'run_resumed',
    message: 'Run resumed from UI',
    payload_json: null,
  })

  return c.json(next)
})

app.get('/api/runs/:id/events/batch', async (c) => {
  const userId = c.get('userId')
  const runId = c.req.param('id')
  const limit = Math.max(1, Math.min(200, Number.parseInt(c.req.query('limit') || '50', 10) || 50))
  const afterId = Number.parseInt(c.req.query('after_id') || '0', 10) || 0
  const storage = storageFor(c)
  const events = await listRunEvents(storage, userId, runId)
  const filtered = events.filter((event) => Number(event.id) > afterId).slice(-limit)
  return c.json(filtered)
})

app.get('/api/runs/:id/events', async (c) => {
  const userId = c.get('userId')
  const runId = c.req.param('id')
  const storage = storageFor(c)
  const events = await listRunEvents(storage, userId, runId)
  const initial = events.slice(-10)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk))

      for (const event of initial) {
        write(`event: run_event\n`)
        write(`data: ${JSON.stringify(event)}\n\n`)
      }

      const heartbeat = setInterval(() => {
        try {
          write(`: keepalive ${Date.now()}\n\n`)
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      setTimeout(() => {
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // no-op
        }
      }, 55000)
    },
    cancel() {
      // no-op
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
})

app.get('/api/jobs', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const items = await listCollection<JobRecord>(storage, userId, 'job')
  const jobs = items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
  return c.json({
    items: jobs,
    counts: {
      total: jobs.length,
      new: jobs.filter((job) => job.status === 'new').length,
      queued: jobs.filter((job) => job.status === 'queued').length,
      applied: jobs.filter((job) => job.status === 'applied').length,
    },
  })
})

app.get('/api/jobs/:id', async (c) => {
  const userId = c.get('userId')
  const jobId = c.req.param('id')
  const storage = storageFor(c)
  const job = await getCollectionItem<JobRecord>(storage, userId, 'job', jobId)
  if (!job) {
    throw new HTTPException(404, { message: 'Job not found' })
  }

  const applications = (await listCollection<ApplicationRecord>(storage, userId, 'application')).filter(
    (item) => item.job_id === jobId,
  )
  const manualActions = (await listCollection<ManualActionRecord>(storage, userId, 'manual-action')).filter(
    (item) => item.job_id === jobId,
  )

  return c.json({
    ...job,
    applications,
    manual_actions: manualActions,
    generated_documents: [],
    explanation: {
      fit_score: job.score,
      notes: 'Synthetic score explanation (storage fallback mode).',
    },
  })
})

app.post('/api/jobs/:id/apply-now', async (c) => {
  const userId = c.get('userId')
  const jobId = c.req.param('id')
  const storage = storageFor(c)
  const job = await getCollectionItem<JobRecord>(storage, userId, 'job', jobId)
  if (!job) {
    throw new HTTPException(404, { message: 'Job not found' })
  }

  const now = nowIso()
  const nextJob: JobRecord = {
    ...job,
    status: 'applied',
    updated_at: now,
  }
  await putCollectionItem(storage, userId, 'job', jobId, nextJob)

  const existingApplications = await listCollection<ApplicationRecord>(storage, userId, 'application')
  const existing = existingApplications.find((item) => item.job_id === jobId)
  if (!existing) {
    const application: ApplicationRecord = {
      id: createId('app'),
      run_id: job.run_id,
      job_id: jobId,
      status: 'submitted',
      source_portal: job.source || null,
      error_code: null,
      confirmation_text: 'Application submitted via quick apply simulation.',
      submitted_at: now,
      created_at: now,
      updated_at: now,
      answers: [],
      generated_documents: [],
      artifacts: {},
    }
    await putCollectionItem(storage, userId, 'application', application.id, application)
  }

  return c.json({ success: true })
})

app.delete('/api/jobs', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const jobs = await listCollection<JobRecord>(storage, userId, 'job')
  const jobIds = new Set(jobs.map((job) => job.id))

  await Promise.all(jobs.map((job) => deleteCollectionItem(storage, userId, 'job', job.id)))

  const applications = await listCollection<ApplicationRecord>(storage, userId, 'application')
  await Promise.all(
    applications
      .filter((item) => jobIds.has(item.job_id))
      .map((item) => deleteCollectionItem(storage, userId, 'application', item.id)),
  )

  const manualActions = await listCollection<ManualActionRecord>(storage, userId, 'manual-action')
  await Promise.all(
    manualActions
      .filter((item) => item.job_id && jobIds.has(item.job_id))
      .map((item) => deleteCollectionItem(storage, userId, 'manual-action', item.id)),
  )

  return c.json({ success: true, deleted_jobs: jobIds.size })
})

app.get('/api/applications', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const applications = await listCollection<ApplicationRecord>(storage, userId, 'application')
  const jobs = await listCollection<JobRecord>(storage, userId, 'job')
  const jobsById = new Map(jobs.map((job) => [job.id, job]))

  return c.json({
    items: applications.map((application) => ({
      ...application,
      job: jobsById.get(application.job_id)
        ? {
            title: jobsById.get(application.job_id)?.title,
            company: jobsById.get(application.job_id)?.company,
            location: jobsById.get(application.job_id)?.location,
            score: jobsById.get(application.job_id)?.score,
            url: jobsById.get(application.job_id)?.url,
          }
        : undefined,
    })),
  })
})

app.get('/api/applications/:id', async (c) => {
  const userId = c.get('userId')
  const applicationId = c.req.param('id')
  const storage = storageFor(c)
  const application = await getCollectionItem<ApplicationRecord>(storage, userId, 'application', applicationId)
  if (!application) {
    throw new HTTPException(404, { message: 'Application not found' })
  }

  const job = application.job_id
    ? await getCollectionItem<JobRecord>(storage, userId, 'job', application.job_id)
    : null
  const run = application.run_id
    ? await getCollectionItem<RunRecord>(storage, userId, 'run', application.run_id)
    : null
  const manualActions = (await listCollection<ManualActionRecord>(storage, userId, 'manual-action')).filter(
    (item) => item.job_id === application.job_id,
  )

  return c.json({
    ...application,
    job,
    run,
    manual_actions: manualActions,
  })
})

app.get('/api/manual-actions', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const items = await listCollection<ManualActionRecord>(storage, userId, 'manual-action')
  return c.json({ items })
})

app.post('/api/manual-actions/:id/start-session', async (c) => {
  const userId = c.get('userId')
  const actionId = c.req.param('id')
  const storage = storageFor(c)
  const action = await getCollectionItem<ManualActionRecord>(storage, userId, 'manual-action', actionId)
  if (!action) {
    throw new HTTPException(404, { message: 'Manual action not found' })
  }

  const config = asObject(await storage.get(userConfigKey(userId, 'default')))
  const configuredSessionUrl = asString(config.session_url).trim()
  const next: ManualActionRecord = {
    ...action,
    status: 'pending',
    session_url: action.session_url || configuredSessionUrl || 'https://app.steel.dev/',
    updated_at: nowIso(),
  }

  await putCollectionItem(storage, userId, 'manual-action', actionId, next)
  return c.json(next)
})

app.post('/api/manual-actions/:id/resolve', async (c) => {
  const userId = c.get('userId')
  const actionId = c.req.param('id')
  const body = await c.req.json<{ status?: 'pending' | 'resolved' | 'blocked'; details?: JsonObject }>()
  const storage = storageFor(c)
  const action = await getCollectionItem<ManualActionRecord>(storage, userId, 'manual-action', actionId)
  if (!action) {
    throw new HTTPException(404, { message: 'Manual action not found' })
  }

  const next: ManualActionRecord = {
    ...action,
    status: body.status || 'resolved',
    details: {
      ...asObject(action.details),
      ...asObject(body.details),
    },
    updated_at: nowIso(),
  }
  await putCollectionItem(storage, userId, 'manual-action', actionId, next)
  return c.json(next)
})

app.post('/api/byok/steel/session', async (c) => {
  const body = await c.req.json<{
    api_key?: string
    project_id?: string
    metadata?: JsonObject
  }>()

  const apiKey = asString(body.api_key).trim()
  if (!apiKey) {
    throw new HTTPException(400, { message: 'api_key is required for BYOK steel session creation' })
  }

  const payload: JsonObject = {
    metadata: asObject(body.metadata),
  }
  if (!Object.keys(payload.metadata as JsonObject).length) {
    payload.metadata = { source: 'huntarr' }
  }

  const projectId = asString(body.project_id).trim()
  if (projectId) {
    payload.projectId = projectId
  }

  const response = await fetch('https://api.steel.dev/v1/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new HTTPException(502, {
      message: text || `Steel API failed with status ${response.status}`,
    })
  }

  const session = (await response.json()) as JsonObject
  return c.json({ ok: true, message: 'Steel key test succeeded', session })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((error) => {
  if (error instanceof HTTPException) {
    return error.getResponse()
  }
  console.error(error)
  return new Response('Internal server error', { status: 500 })
})

export const onRequest = handle(app)
