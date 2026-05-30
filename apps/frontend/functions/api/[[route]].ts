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

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>()

app.use('/api/*', cors())

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health') {
    await next()
    return
  }

  const authHeader = c.req.header('Authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    throw new HTTPException(401, { message: 'Missing bearer token' })
  }

  const jwksUrl = c.env.CLERK_JWKS_URL
  const clerkIssuer = c.env.CLERK_ISSUER

  if (!jwksUrl || !clerkIssuer) {
    const devUserId = c.req.header('x-dev-user-id') || ''
    if (!devUserId) {
      throw new HTTPException(500, {
        message: 'Missing CLERK_JWKS_URL/CLERK_ISSUER and no x-dev-user-id provided',
      })
    }
    c.set('userId', devUserId)
    await next()
    return
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(jwksUrl))
    const { payload } = await jwtVerify(token, JWKS, { issuer: clerkIssuer })
    if (!payload.sub) {
      throw new Error('Token missing sub')
    }
    c.set('userId', String(payload.sub))
    await next()
  } catch (error) {
    throw new HTTPException(401, {
      message: `Invalid auth token: ${error instanceof Error ? error.message : 'unknown error'}`,
    })
  }
})

function sqlClient(c: {
  env: Env
}) {
  const databaseUrl = c.env.NEON_DATABASE_URL
  if (!databaseUrl) {
    throw new HTTPException(500, { message: 'Missing NEON_DATABASE_URL binding' })
  }
  return neon(databaseUrl)
}

function userScopedConfigKey(userId: string, key: string): string {
  const cleanKey = key.trim() || 'default'
  return `u:${userId}:cfg:${cleanKey}`
}

function userCredentialConfigPrefix(userId: string): string {
  return `u:${userId}:cred:`
}

function userCredentialConfigKey(userId: string, domain: string, username: string): string {
  return `${userCredentialConfigPrefix(userId)}${encodeURIComponent(domain)}:${encodeURIComponent(username)}`
}

app.get('/api/health', async (c) => {
  const sql = sqlClient(c)
  const rows = (await sql`SELECT NOW()::text AS now`) as Array<{ now: string }>
  return c.json({ status: 'ok', database_time: rows[0]?.now ?? null })
})

app.get('/api/config', async (c) => {
  const userId = c.get('userId')
  const key = c.req.query('key') || 'default'
  const sql = sqlClient(c)
  const scopedKey = userScopedConfigKey(userId, key)
  const rows = (await sql`
    SELECT value
    FROM configs
    WHERE key = ${scopedKey}
  `) as Array<{ value: Record<string, unknown> }>

  if (!rows[0]) {
    return c.json({ key, value: {} })
  }

  return c.json({ key, value: rows[0].value ?? {} })
})

app.put('/api/config', async (c) => {
  const userId = c.get('userId')
  const key = c.req.query('key') || 'default'
  const body = await c.req.json<{ value?: Record<string, unknown> }>()
  const value = body?.value ?? {}
  const sql = sqlClient(c)
  const scopedKey = userScopedConfigKey(userId, key)

  const rows = (await sql`
    INSERT INTO configs(key, value)
    VALUES (${scopedKey}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    RETURNING value
  `) as Array<{ value: Record<string, unknown> }>

  return c.json({ key, value: rows[0]?.value ?? value })
})

app.get('/api/credentials', async (c) => {
  const userId = c.get('userId')
  const sql = sqlClient(c)
  const prefix = `${userCredentialConfigPrefix(userId)}%`
  const rows = (await sql`
    SELECT key, value
    FROM configs
    WHERE key LIKE ${prefix}
    ORDER BY updated_at DESC
  `) as Array<{ key: string; value: Record<string, unknown> }>

  const items = rows.map((row) => {
    const keyWithoutPrefix = row.key.replace(userCredentialConfigPrefix(userId), '')
    const [encodedDomain, encodedUsername] = keyWithoutPrefix.split(':')
    return {
      domain: decodeURIComponent(encodedDomain || ''),
      username: decodeURIComponent(encodedUsername || ''),
      metadata: row.value?.metadata ?? {},
      created_at: row.value?.updated_at ?? null,
    }
  })

  return c.json({ items })
})

app.get('/api/credentials/:domain/:username', async (c) => {
  const userId = c.get('userId')
  const domain = c.req.param('domain')
  const username = c.req.param('username')
  const sql = sqlClient(c)
  const scopedKey = userCredentialConfigKey(userId, domain, username)

  const rows = (await sql`
    SELECT value
    FROM configs
    WHERE key = ${scopedKey}
  `) as Array<{ value: Record<string, unknown> }>

  if (!rows[0]) {
    throw new HTTPException(404, { message: 'Credential not found' })
  }

  return c.json({
    domain,
    username,
    metadata: rows[0].value?.metadata ?? {},
    password: rows[0].value?.password ?? '',
  })
})

app.post('/api/credentials', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<{
    domain: string
    username: string
    password: string
    metadata?: Record<string, unknown>
  }>()

  const domain = (body.domain || '').trim()
  const username = (body.username || '').trim()
  const password = (body.password || '').trim()
  if (!domain || !username || !password) {
    throw new HTTPException(400, { message: 'domain, username, and password are required' })
  }

  const sql = sqlClient(c)
  const scopedKey = userCredentialConfigKey(userId, domain, username)
  const value = {
    password,
    metadata: body.metadata ?? {},
    updated_at: new Date().toISOString(),
  }

  await sql`
    INSERT INTO configs(key, value)
    VALUES (${scopedKey}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `

  return c.json({ domain, username, metadata: body.metadata ?? {} })
})

app.delete('/api/credentials/:domain/:username', async (c) => {
  const userId = c.get('userId')
  const domain = c.req.param('domain')
  const username = c.req.param('username')
  const sql = sqlClient(c)
  const scopedKey = userCredentialConfigKey(userId, domain, username)

  await sql`DELETE FROM configs WHERE key = ${scopedKey}`
  return c.json({ success: true })
})

app.post('/api/byok/steel/session', async (c) => {
  const body = await c.req.json<{
    api_key?: string
    project_id?: string
    metadata?: Record<string, unknown>
  }>()

  const apiKey = (body.api_key || '').trim()
  if (!apiKey) {
    throw new HTTPException(400, { message: 'api_key is required for BYOK steel session creation' })
  }

  const payload: Record<string, unknown> = {
    metadata: body.metadata ?? { source: 'huntarr' },
  }
  const projectId = (body.project_id || '').trim()
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

  const data = await response.json<Record<string, unknown>>()
  return c.json({ ok: true, message: 'Steel key test succeeded', session: data })
})

app.all('*', (c) => c.json({ error: 'Not found' }, 404))

export const onRequest = app.fetch
