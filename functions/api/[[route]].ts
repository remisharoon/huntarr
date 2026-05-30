import { neon } from '@neondatabase/serverless'
import { Hono } from 'hono'
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

type LLMProviderRecord = {
  id: string
  name: string
  base_url: string
  model: string
  api_key: string | null
  key_source: 'none' | 'env' | 'vault'
  created_at: string
  updated_at: string
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
  job_sources: {
    remoteok: true,
    weworkremotely: true,
    brave_search: true,
  },
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

function isSseEventsPath(path: string): boolean {
  return /^\/api\/runs\/[^/]+\/events$/.test(path)
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
    if (isSseEventsPath(path)) {
      c.set('userId', DEFAULT_USER_ID)
      await next()
      return
    }
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

app.get('/api/llm/providers', async (c) => {
  const userId = c.get('userId')
  const storage = storageFor(c)
  const activeProviderId = asString(await storage.get(userConfigKey(userId, 'llm_active_provider_id')), '') || null
  const providers = await listCollection<LLMProviderRecord>(storage, userId, 'llm-provider')
  return c.json({
    active_provider_id: activeProviderId,
    items: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      base_url: provider.base_url,
      model: provider.model,
      has_api_key: Boolean(provider.api_key),
      key_source: provider.key_source || 'none',
      is_active: provider.id === activeProviderId,
      updated_at: provider.updated_at,
    })),
  })
})

app.post('/api/llm/providers', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    name?: string
    base_url?: string
    model?: string
    api_key?: string
  }>()

  const name = asString(body.name).trim()
  const baseUrl = asString(body.base_url).trim()
  const model = asString(body.model).trim()
  if (!name || !baseUrl || !model) {
    throw new HTTPException(400, { message: 'name, base_url, and model are required' })
  }

  const now = nowIso()
  const provider: LLMProviderRecord = {
    id: createId('llm'),
    name,
    base_url: baseUrl,
    model,
    api_key: asString(body.api_key).trim() || null,
    key_source: asString(body.api_key).trim() ? 'vault' : 'none',
    created_at: now,
    updated_at: now,
  }

  const storage = storageFor(c)
  await putCollectionItem(storage, userId, 'llm-provider', provider.id, provider)

  const activeProviderId = asString(await storage.get(userConfigKey(userId, 'llm_active_provider_id')))
  if (!activeProviderId) {
    await storage.put(userConfigKey(userId, 'llm_active_provider_id'), provider.id)
  }

  return c.json({ id: provider.id }, 201)
})

app.put('/api/llm/providers/:id', async (c) => {
  const userId = c.get('userId')
  const providerId = c.req.param('id')
  const storage = storageFor(c)
  const current = await getCollectionItem<LLMProviderRecord>(storage, userId, 'llm-provider', providerId)
  if (!current) {
    throw new HTTPException(404, { message: 'Provider not found' })
  }

  const body = await c.req.json<{
    name?: string
    base_url?: string
    model?: string
    api_key?: string
  }>()

  const next: LLMProviderRecord = {
    ...current,
    name: asString(body.name, current.name).trim() || current.name,
    base_url: asString(body.base_url, current.base_url).trim() || current.base_url,
    model: asString(body.model, current.model).trim() || current.model,
    updated_at: nowIso(),
  }

  if (typeof body.api_key === 'string') {
    next.api_key = body.api_key.trim() || null
    next.key_source = next.api_key ? 'vault' : 'none'
  }

  await putCollectionItem(storage, userId, 'llm-provider', providerId, next)
  return c.json({ success: true })
})

app.post('/api/llm/providers/:id/activate', async (c) => {
  const userId = c.get('userId')
  const providerId = c.req.param('id')
  const storage = storageFor(c)
  const provider = await getCollectionItem<LLMProviderRecord>(storage, userId, 'llm-provider', providerId)
  if (!provider) {
    throw new HTTPException(404, { message: 'Provider not found' })
  }
  await storage.put(userConfigKey(userId, 'llm_active_provider_id'), providerId)
  return c.json({ success: true })
})

app.delete('/api/llm/providers/:id', async (c) => {
  const userId = c.get('userId')
  const providerId = c.req.param('id')
  const storage = storageFor(c)
  await deleteCollectionItem(storage, userId, 'llm-provider', providerId)

  const activeProviderId = asString(await storage.get(userConfigKey(userId, 'llm_active_provider_id')))
  if (activeProviderId === providerId) {
    await storage.put(userConfigKey(userId, 'llm_active_provider_id'), '')
  }

  return c.json({ success: true })
})

app.post('/api/llm/providers/test', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    provider_id?: string
    base_url?: string
    model?: string
    api_key?: string
  }>()

  const storage = storageFor(c)
  let baseUrl = asString(body.base_url).trim()
  let model = asString(body.model).trim()
  let apiKey = asString(body.api_key).trim()

  if (body.provider_id) {
    const provider = await getCollectionItem<LLMProviderRecord>(storage, userId, 'llm-provider', body.provider_id)
    if (!provider) {
      throw new HTTPException(404, { message: 'Provider not found' })
    }
    baseUrl = baseUrl || provider.base_url
    model = model || provider.model
    apiKey = apiKey || asString(provider.api_key)
  }

  if (!baseUrl || !model) {
    throw new HTTPException(400, { message: 'base_url and model are required' })
  }
  if (!apiKey) {
    throw new HTTPException(400, { message: 'No API key available for provider test' })
  }

  const normalized = baseUrl.replace(/\/+$/, '')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`${normalized}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply only with: ok' }],
        max_tokens: 8,
        temperature: 0,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const message = await response.text()
      throw new HTTPException(502, { message: message || `Provider test failed (${response.status})` })
    }

    return c.json({ ok: true, message: 'Provider test succeeded' })
  } finally {
    clearTimeout(timeout)
  }
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
  return c.json({ ...defaultProfile, ...existing })
})

app.put('/api/profile', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<Partial<ProfileRecord>>()
  const storage = storageFor(c)
  const current = asObject(await storage.get(userConfigKey(userId, 'profile')))
  const next = {
    ...defaultProfile,
    ...current,
    ...asObject(body),
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

  const filename = input.name || 'resume'
  const inferredName = filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[\-_]+/g, ' ')
    .trim()

  const extracted: Partial<ProfileRecord> = {
    full_name: inferredName || defaultProfile.full_name,
    summary: inferredName ? `Imported from resume: ${filename}` : defaultProfile.summary,
    resume_path: `uploads/${createId('resume')}-${filename}`,
  }

  const storage = storageFor(c)
  const current = asObject(await storage.get(userConfigKey(userId, 'profile')))
  await storage.put(userConfigKey(userId, 'profile'), {
    ...defaultProfile,
    ...current,
    ...extracted,
  })

  return c.json(extracted)
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

  const storage = storageFor(c)
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

  const seededJob: JobRecord = {
    id: createId('job'),
    title: role,
    company: 'Example Labs',
    location: asString((run.search_config.locations as unknown[] | undefined)?.[0], 'Remote'),
    source: 'manual_seed',
    url: 'https://example.com/jobs',
    score: 0.72,
    status: 'new',
    description: 'Seeded job created from manual run to validate dashboard flow.',
    posted_at: now,
    run_id: run.id,
    last_run_id: run.id,
    created_at: now,
    updated_at: now,
  }
  await putCollectionItem(storage, userId, 'job', seededJob.id, seededJob)

  return c.json(run, 201)
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

export const onRequest = app.fetch
