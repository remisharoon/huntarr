import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { onRequest } from '../[[route]]'

type ApiResult<T = any> = {
  status: number
  body: T
}

type ApiRequestInit = {
  method?: string
  headers?: HeadersInit
  body?: unknown
}

type FetchScenario = {
  jobUrl: string
  leverSubmitOk?: boolean
  leverTransientFailures?: number
  greenhouseSubmitOk?: boolean
  greenhouseQuestionsOk?: boolean
  greenhouseQuestions?: any
  steelSessionOk?: boolean
}

const BASE_PROFILE = {
  full_name: 'Taylor Example',
  email: 'taylor@example.com',
  phone: '+1-555-0102',
  location: 'Chicago, IL',
  years_experience: 7,
  summary: 'Senior engineer focused on scalable backend systems.',
  skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
  experience: [{ title: 'Senior Engineer', company: 'Acme', start: '2021', end: 'Present' }],
  education: [{ degree: 'BS Computer Science', institution: 'State University', year: '2018' }],
  job_sources: {
    remoteok: true,
    weworkremotely: false,
    remotive: false,
    themuse: false,
    arbeitnow: false,
    brave_search: false,
    adzuna: false,
    usajobs: false,
  },
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createExternalFetchMock(scenario: FetchScenario) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method || 'GET').toUpperCase()

    if (url.startsWith('https://remoteok.com/api')) {
      return jsonResponse([
        { id: 0 },
        {
          id: 1,
          position: 'Senior Data Engineer',
          company: 'Thoughtworks',
          location: 'Remote',
          url: scenario.jobUrl,
          description: 'Test posting for integration path checks.',
          iso_date: '2026-05-31T15:00:00.000Z',
        },
      ])
    }

    if (url.startsWith('https://api.lever.co/v0/postings/')) {
      const transientCount = scenario.leverTransientFailures || 0
      if (transientCount > 0) {
        scenario.leverTransientFailures = transientCount - 1
        return jsonResponse({ error: 'rate limited' }, 429)
      }
      if (scenario.leverSubmitOk) {
        return jsonResponse({ id: 'lever-confirmation-123' }, 200)
      }
      return jsonResponse({ error: 'lever rejected request' }, 422)
    }

    if (url.includes('boards-api.greenhouse.io') && url.includes('?questions=true')) {
      if (scenario.greenhouseQuestionsOk === false) {
        return jsonResponse({ error: 'question retrieval unavailable' }, 500)
      }
      return jsonResponse(
        scenario.greenhouseQuestions || {
          id: 123,
          questions: [
            { required: true, label: 'First Name', fields: [{ name: 'first_name', type: 'input_text' }] },
            { required: true, label: 'Last Name', fields: [{ name: 'last_name', type: 'input_text' }] },
            { required: true, label: 'Email', fields: [{ name: 'email', type: 'input_text' }] },
            { required: false, label: 'LinkedIn', fields: [{ name: 'question_linkedin', type: 'input_text' }] },
          ],
        },
        200,
      )
    }

    if (url.startsWith('https://boards-api.greenhouse.io/v1/boards/')) {
      if (scenario.greenhouseSubmitOk) {
        return jsonResponse({ id: 'greenhouse-confirmation-456' }, 200)
      }
      return jsonResponse({ error: 'greenhouse rejected request' }, 422)
    }

    if (url === 'https://api.steel.dev/v1/sessions') {
      if (scenario.steelSessionOk === false) {
        return new Response('steel session unavailable', { status: 500 })
      }
      return jsonResponse(
        {
          id: 'steel-session-1',
          session_viewer_url: 'https://app.steel.dev/sessions/steel-session-1',
        },
        200,
      )
    }

    if (url.includes('myworkdayjobs.com') && method === 'GET') {
      return new Response(
        '<html><body><h1>Workday Job</h1><p>Sign in to apply for this role.</p></body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      )
    }

    if (url.includes('/wday/cxs/') && method === 'POST') {
      return jsonResponse(
        {
          jobPostings: [
            {
              title: 'Senior Data Engineer',
              externalPath: '/en-US/acme/job/123',
              applyUrl: scenario.jobUrl,
            },
          ],
        },
        200,
      )
    }

    throw new Error(`Unexpected outbound fetch in test: ${url}`)
  })
}

async function callApi<T = any>(path: string, init?: ApiRequestInit): Promise<ApiResult<T>> {
  const headers = new Headers(init?.headers)
  const hasBodyObject = Boolean(init?.body) && typeof init?.body === 'object' && !(init?.body instanceof FormData)
  const body = hasBodyObject ? JSON.stringify(init?.body) : init?.body
  const requestBody = body as BodyInit | null | undefined
  if (body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const request = new Request(`http://localhost${path}`, {
    method: init?.method || 'GET',
    headers,
    body: requestBody,
  })

  const response = await onRequest({
    request,
    env: {},
    params: {},
    data: {},
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    next: async () => new Response('Not found', { status: 404 }),
  } as any)

  const text = await response.text()
  let parsed: any = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  return {
    status: response.status,
    body: parsed,
  }
}

async function resetWorkspaceState(): Promise<void> {
  await callApi('/api/jobs', { method: 'DELETE' })

  const credentials = await callApi<{ items: Array<{ domain: string; username: string }> }>('/api/credentials')
  for (const cred of credentials.body.items || []) {
    await callApi(`/api/credentials/${encodeURIComponent(cred.domain)}/${encodeURIComponent(cred.username)}`, {
      method: 'DELETE',
    })
  }

  await callApi('/api/config', {
    method: 'PUT',
    body: { value: { auto_submit_enabled: true, browser_headless: true } },
  })

  await callApi('/api/profile', {
    method: 'PUT',
    body: BASE_PROFILE,
  })
}

async function createRunAndGetFirstJobId(): Promise<string> {
  const run = await callApi('/api/runs', {
    method: 'POST',
    body: {
      mode: 'manual',
      search_config: {
        role_keywords: ['Data Engineer'],
        locations: ['Remote'],
        sources: ['remoteok'],
        max_jobs_per_run: 20,
      },
    },
  })
  expect(run.status).toBe(201)

  const jobs = await callApi<{ items: Array<{ id: string }> }>('/api/jobs')
  expect(jobs.status).toBe(200)
  expect(Array.isArray(jobs.body.items)).toBe(true)
  expect(jobs.body.items.length).toBeGreaterThan(0)

  return jobs.body.items[0].id
}

describe('apply-now integration paths', () => {
  const originalFetch = globalThis.fetch

  beforeEach(async () => {
    await resetWorkspaceState()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('marks application submitted when Lever API auto-submit succeeds', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://jobs.lever.co/acme/role-123',
      leverSubmitOk: true,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('submitted')
    expect(apply.body.success).toBe(true)

    const applications = await callApi<{ items: Array<{ status: string; confirmation_text: string }> }>('/api/applications')
    expect(applications.body.items.length).toBeGreaterThan(0)
    expect(applications.body.items[0].status).toBe('submitted')
    expect(String(applications.body.items[0].confirmation_text)).toContain('Lever')

    const manualActions = await callApi<{ items: any[] }>('/api/manual-actions')
    expect(manualActions.body.items.length).toBe(0)

    const calledSteel = mockedFetch.mock.calls.some((call) => {
      const input = call[0]
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url === 'https://api.steel.dev/v1/sessions'
    })
    expect(calledSteel).toBe(false)
  })

  it('retries Lever submit on transient 429 and still succeeds without Steel', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://jobs.lever.co/acme/role-123',
      leverSubmitOk: true,
      leverTransientFailures: 1,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('submitted')

    const applications = await callApi<{ items: Array<{ artifacts?: any }> }>('/api/applications')
    expect(applications.body.items[0].artifacts?.auto_submit_attempt?.attempts).toBe(2)

    const calledSteel = mockedFetch.mock.calls.some((call) => {
      const input = call[0]
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url === 'https://api.steel.dev/v1/sessions'
    })
    expect(calledSteel).toBe(false)
  })

  it('auto-submits via Greenhouse with question-aware mapping and no Steel', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://boards.greenhouse.io/acme/jobs/98765',
      greenhouseSubmitOk: true,
      greenhouseQuestionsOk: true,
      greenhouseQuestions: {
        id: 98765,
        questions: [
          { required: true, label: 'First Name', fields: [{ name: 'first_name', type: 'input_text' }] },
          { required: true, label: 'Last Name', fields: [{ name: 'last_name', type: 'input_text' }] },
          { required: true, label: 'Email', fields: [{ name: 'email', type: 'input_text' }] },
          { required: false, label: 'LinkedIn', fields: [{ name: 'linkedin_profile', type: 'input_text' }] },
        ],
      },
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    await callApi('/api/profile', {
      method: 'PUT',
      body: {
        ...BASE_PROFILE,
        links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/taylor-example' }],
      },
    })

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('submitted')

    const applications = await callApi<{ items: Array<{ artifacts?: any }> }>('/api/applications')
    expect(applications.body.items[0].artifacts?.auto_submit_attempt?.ats).toBe('greenhouse')
    expect(applications.body.items[0].artifacts?.auto_submit_attempt?.mapped_fields?.linkedin_profile).toBe(
      'https://linkedin.com/in/taylor-example',
    )
  })

  it('falls back to manual_required without creating live Steel session when ATS auto-submit is unsupported', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://acme.wd5.myworkdayjobs.com/en-US/acme/job/123',
      steelSessionOk: true,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    await callApi('/api/credentials', {
      method: 'POST',
      body: {
        domain: 'steel.dev',
        username: 'default',
        password: 'test-steel-key',
        metadata: { provider: 'steel', byok: true },
      },
    })

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('manual_required')
    expect(apply.body.success).toBe(false)
    expect(typeof apply.body.manual_action_id).toBe('string')
    expect(apply.body.session_url).toBeNull()

    const manualActions = await callApi<{ items: Array<{ status: string; action_type: string; session_url: string | null; details?: any }> }>('/api/manual-actions')
    expect(manualActions.body.items.length).toBe(1)
    expect(manualActions.body.items[0].status).toBe('pending')
    expect(manualActions.body.items[0].action_type).toBe('complete_application_submission')
    expect(manualActions.body.items[0].session_url).toBeNull()
    expect(manualActions.body.items[0].details?.manual_portal_url).toBe('https://acme.wd5.myworkdayjobs.com/en-US/acme/job/123')

    const calledSteel = mockedFetch.mock.calls.some((call) => {
      const input = call[0]
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url === 'https://api.steel.dev/v1/sessions'
    })
    expect(calledSteel).toBe(false)

    const applications = await callApi<{ items: Array<{ status: string; artifacts?: any }> }>('/api/applications')
    expect(applications.body.items.length).toBeGreaterThan(0)
    expect(applications.body.items[0].status).toBe('manual_required')
    expect(applications.body.items[0].artifacts?.auto_submit_attempt?.ats).toBe('workday')
    expect(typeof applications.body.items[0].artifacts?.auto_submit_attempt?.error_code).toBe('string')
    expect(applications.body.items[0].artifacts?.manual_fallback?.steel_session_policy).toBe('on_demand_only')
  })

  it('creates Steel session on manual start-session only', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://careers.acme-example.com/jobs/12345',
      steelSessionOk: true,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    await callApi('/api/credentials', {
      method: 'POST',
      body: {
        domain: 'steel.dev',
        username: 'default',
        password: 'test-steel-key',
        metadata: { provider: 'steel', byok: true },
      },
    })

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('manual_required')

    const manualActions = await callApi<{ items: Array<{ id: string; session_url: string | null }> }>('/api/manual-actions')
    expect(manualActions.body.items.length).toBe(1)
    expect(manualActions.body.items[0].session_url).toBeNull()

    const startSession = await callApi<{ session_url: string; details?: any }>(
      '/api/manual-actions/' + manualActions.body.items[0].id + '/start-session',
      { method: 'POST' },
    )

    expect(startSession.status).toBe(200)
    expect(startSession.body.session_url).toBe('https://app.steel.dev/sessions/steel-session-1')
    expect(startSession.body.details?.session_id).toBe('steel-session-1')

    const calledSteel = mockedFetch.mock.calls.some((call) => {
      const input = call[0]
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url === 'https://api.steel.dev/v1/sessions'
    })
    expect(calledSteel).toBe(true)
  })

  it('returns validation error when starting live session without Steel credential', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://careers.acme-example.com/jobs/12345',
      steelSessionOk: true,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('manual_required')

    const manualActions = await callApi<{ items: Array<{ id: string; session_url: string | null }> }>('/api/manual-actions')
    expect(manualActions.body.items.length).toBe(1)

    const startSession = await callApi('/api/manual-actions/' + manualActions.body.items[0].id + '/start-session', {
      method: 'POST',
    })

    expect(startSession.status).toBe(400)
    expect(JSON.stringify(startSession.body)).toContain('Steel API key is missing')

    const calledSteel = mockedFetch.mock.calls.some((call) => {
      const input = call[0]
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url === 'https://api.steel.dev/v1/sessions'
    })
    expect(calledSteel).toBe(false)
  })

  it('returns upstream error when on-demand Steel session creation fails', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://careers.acme-example.com/jobs/12345',
      steelSessionOk: false,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    await callApi('/api/credentials', {
      method: 'POST',
      body: {
        domain: 'steel.dev',
        username: 'default',
        password: 'test-steel-key',
        metadata: { provider: 'steel', byok: true },
      },
    })

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('manual_required')

    const manualActions = await callApi<{ items: Array<{ id: string }> }>('/api/manual-actions')
    expect(manualActions.body.items.length).toBe(1)

    const startSession = await callApi('/api/manual-actions/' + manualActions.body.items[0].id + '/start-session', {
      method: 'POST',
    })
    expect(startSession.status).toBe(502)
    expect(JSON.stringify(startSession.body)).toContain('steel session unavailable')
  })

  it('blocks live Steel start-session for ATS in strict no-steel list', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://acme.wd5.myworkdayjobs.com/en-US/acme/job/123',
      steelSessionOk: true,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    await callApi('/api/credentials', {
      method: 'POST',
      body: {
        domain: 'steel.dev',
        username: 'default',
        password: 'test-steel-key',
        metadata: { provider: 'steel', byok: true },
      },
    })

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })
    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('manual_required')

    const manualActions = await callApi<{ items: Array<{ id: string; details?: any }> }>('/api/manual-actions')
    expect(manualActions.body.items[0].details?.steel_blocked_for_ats).toBe(true)

    const startSession = await callApi('/api/manual-actions/' + manualActions.body.items[0].id + '/start-session', {
      method: 'POST',
    })
    expect(startSession.status).toBe(400)
    expect(JSON.stringify(startSession.body)).toContain('disabled for this ATS')
  })

  it('allows live Steel start-session for workday when no_steel_ats is explicitly empty', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://acme.wd5.myworkdayjobs.com/en-US/acme/job/123',
      steelSessionOk: true,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    await callApi('/api/config', {
      method: 'PUT',
      body: {
        value: {
          auto_submit_enabled: true,
          browser_headless: true,
          no_steel_ats: [],
        },
      },
    })

    await callApi('/api/credentials', {
      method: 'POST',
      body: {
        domain: 'steel.dev',
        username: 'default',
        password: 'test-steel-key',
        metadata: { provider: 'steel', byok: true },
      },
    })

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })
    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('manual_required')

    const manualActions = await callApi<{ items: Array<{ id: string; details?: any }> }>('/api/manual-actions')
    expect(manualActions.body.items[0].details?.steel_blocked_for_ats).toBe(false)

    const startSession = await callApi('/api/manual-actions/' + manualActions.body.items[0].id + '/start-session', {
      method: 'POST',
    })
    expect(startSession.status).toBe(200)
    expect(startSession.body.session_url).toBe('https://app.steel.dev/sessions/steel-session-1')
  })

  it('uses Lever hosted apply URL for non-Steel manual fallback when API submit is rejected', async () => {
    const mockedFetch = createExternalFetchMock({
      jobUrl: 'https://jobs.lever.co/acme/role-123',
      leverSubmitOk: false,
      steelSessionOk: true,
    })
    globalThis.fetch = mockedFetch as typeof globalThis.fetch

    const jobId = await createRunAndGetFirstJobId()
    const apply = await callApi('/api/jobs/' + jobId + '/apply-now', { method: 'POST' })

    expect(apply.status).toBe(200)
    expect(apply.body.status).toBe('manual_required')

    const manualActions = await callApi<{ items: Array<{ details?: any }> }>('/api/manual-actions')
    expect(manualActions.body.items.length).toBe(1)
    expect(manualActions.body.items[0].details?.manual_portal_url).toBe('https://jobs.lever.co/acme/role-123/apply')

    const calledSteel = mockedFetch.mock.calls.some((call) => {
      const input = call[0]
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url === 'https://api.steel.dev/v1/sessions'
    })
    expect(calledSteel).toBe(false)
  })
})
