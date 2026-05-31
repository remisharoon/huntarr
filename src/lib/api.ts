import type { Profile, Run, RunEvent } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

type AuthTokenResolver = () => Promise<string | null>

let authTokenResolver: AuthTokenResolver | null = null

export function setApiAuthTokenResolver(resolver: AuthTokenResolver | null): void {
  authTokenResolver = resolver
}

export type HuntPreflightResponse = {
  can_start: boolean
  blockers: string[]
  warnings: string[]
  missing_profile_fields: string[]
  checked_at: string
}

export type ResumeImportResponse = Partial<Profile> & {
  extraction_warnings?: string[]
  extraction_status?: 'success' | 'partial' | 'fallback'
  extraction_warning_codes?: Array<
    | 'rate_limited'
    | 'unauthorized'
    | 'provider_unavailable'
    | 'invalid_json'
    | 'empty_response'
    | 'provider_error'
    | 'fallback_regex'
    | 'unknown'
  >
  extraction_failed_passes?: Array<'identity' | 'summary' | 'career' | 'portfolio'>
}

type ApiErrorInit = {
  message: string
  status: number
  path: string
  hint?: string
  rawBody?: string
}

type ErrorPayload = {
  message?: string
  error?: string
}

export class ApiError extends Error {
  status: number
  path: string
  hint?: string
  rawBody?: string

  constructor(init: ApiErrorInit) {
    super(init.hint ? `${init.message} ${init.hint}` : init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.path = init.path
    this.hint = init.hint
    this.rawBody = init.rawBody
  }
}

function looksLikeHtml(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return /<!doctype\s+html|<html[\s>]/i.test(normalized)
}

function isCloudflareWorkerCrash(value: string): boolean {
  return /worker threw exception|cf-error-code|cloudflare ray id|error\s*1101/i.test(value)
}

function compactForUi(value: string): string {
  const oneLine = value.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= 320) {
    return oneLine
  }
  return `${oneLine.slice(0, 317)}...`
}

function parseErrorMessage(response: Response, rawBody: string): string {
  const contentType = response.headers.get('content-type') || ''
  const text = rawBody.trim()

  if (isCloudflareWorkerCrash(text)) {
    return 'Cloudflare Pages Function crashed while handling this request.'
  }

  if (contentType.includes('application/json')) {
    try {
      const body = JSON.parse(rawBody) as ErrorPayload
      const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : ''
      if (message.trim()) {
        return message.trim()
      }
    } catch {
      // Ignore parse errors and fall through.
    }
  }

  if (!text) {
    return `Request failed with HTTP ${response.status}`
  }

  if (looksLikeHtml(text)) {
    return `API returned an HTML error page (HTTP ${response.status})`
  }

  return text
}

function buildErrorHint(status: number, message: string): string | undefined {
  if (/clerk auth misconfigured/i.test(message)) {
    return 'Set CLERK_JWKS_URL and CLERK_ISSUER in Cloudflare Pages variables, then redeploy.'
  }
  if (/worker threw exception|cloudflare pages function crashed|error\s*1101/i.test(message)) {
    return 'Open Cloudflare Pages Function logs and fix the runtime exception before retrying.'
  }
  if (status === 401) {
    return 'Sign in again. If this continues, verify Clerk JWT settings in Cloudflare Pages.'
  }
  if (status === 429 || /rate\s*limit|too\s*many\s*requests|quota/i.test(message)) {
    return 'OpenRouter is rate-limited or quota-limited. Retry shortly, switch to a different model, or increase provider limits.'
  }
  if (status >= 500) {
    if (/openrouter|provider returned error|code":\s*429|too many requests|rate\s*limit/i.test(message)) {
      return 'OpenRouter provider is currently unavailable or rate-limited. Retry shortly or switch to a less-congested model.'
    }
    return 'Check required backend services and env vars (Pages Functions, Neon, Clerk) and then redeploy.'
  }
  if (status === 0) {
    return 'Check network connectivity and confirm the Cloudflare Pages deployment is reachable.'
  }
  return undefined
}

export function formatApiError(error: unknown, context?: string): string {
  const prefix = context ? `${context}: ` : ''

  if (error instanceof ApiError) {
    return `${prefix}${compactForUi(error.message)}`
  }

  if (error instanceof Error) {
    return `${prefix}${compactForUi(error.message || 'Unexpected error')}`
  }

  return `${prefix}Unexpected error`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authToken = authTokenResolver ? await authTokenResolver() : null
  const headers = new Headers(init?.headers ?? {})
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers,
      ...init,
    })
  } catch (error) {
    throw new ApiError({
      message: 'Could not reach the API service.',
      status: 0,
      path,
      hint: buildErrorHint(0, ''),
      rawBody: error instanceof Error ? error.message : undefined,
    })
  }

  if (!response.ok) {
    const text = await response.text()
    const message = parseErrorMessage(response, text)
    throw new ApiError({
      message,
      status: response.status,
      path,
      hint: buildErrorHint(response.status, message),
      rawBody: text,
    })
  }
  return (await response.json()) as T
}

export const api = {
  listRuns: () => request<{ items: any[] }>('/api/runs'),
  getRun: (id: string) => request<Run>(`/api/runs/${id}`),
  getRunEvents: (id: string, limit: number = 50, afterId: number = 0) =>
    request<RunEvent[]>(`/api/runs/${id}/events/batch?limit=${limit}&after_id=${afterId}`),
  getRunApplications: (id: string) =>
    request<{ items: any[] }>('/api/applications').then((res) => ({
      items: res.items.filter((app: any) => app.run_id === id),
    })),
  getRunManualActions: (id: string) =>
    request<{ items: any[] }>('/api/manual-actions').then((res) => ({
      items: res.items.filter((action: any) => action.run_id === id),
    })),
  createRun: (body: Record<string, unknown>) =>
    request('/api/runs', { method: 'POST', body: JSON.stringify(body) }),
  getHuntPreflight: () => request<HuntPreflightResponse>('/api/runs/preflight'),
  pauseRun: (id: string) => request(`/api/runs/${id}/pause`, { method: 'POST' }),
  resumeRun: (id: string) => request(`/api/runs/${id}/resume`, { method: 'POST' }),
  listJobs: () =>
    request<{ items: any[]; counts?: { total: number; new: number; queued: number; applied: number } }>(
      '/api/jobs',
    ),
  getJob: (id: string) => request(`/api/jobs/${id}`),
  getJobDetail: (id: string) => request(`/api/jobs/${id}`),
  applyNow: (id: string) => request(`/api/jobs/${id}/apply-now`, { method: 'POST' }),
  deleteJobs: () => request('/api/jobs', { method: 'DELETE' }),
  listApplications: () => request<{ items: any[] }>('/api/applications'),
  getApplicationDetail: (id: string) => request(`/api/applications/${id}`),
  listManualActions: () => request<{ items: any[] }>('/api/manual-actions'),
  startManualSession: (id: string) => request(`/api/manual-actions/${id}/start-session`, { method: 'POST' }),
  resolveManualAction: (id: string) =>
    request(`/api/manual-actions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status: 'resolved', details: { source: 'ui' } }),
    }),
  getProfile: () => request<Profile>('/api/profile'),
  saveProfile: (body: Profile) =>
    request<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
  getConfig: () => request('/api/config'),
  putConfig: (value: Record<string, unknown>) =>
    request('/api/config', { method: 'PUT', body: JSON.stringify({ value }) }),
  listSchedules: () => request<{ items: any[] }>('/api/schedules'),
  createSchedule: (body: Record<string, unknown>) =>
    request('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),
  deleteSchedule: (id: string) =>
    request(`/api/schedules/${id}`, { method: 'DELETE' }),
  listCredentials: () => request<{ items: any[] }>('/api/credentials'),
  getCredential: (domain: string, username: string) =>
    request(`/api/credentials/${domain}/${username}`),
  deleteCredential: (domain: string, username: string) =>
    request(`/api/credentials/${domain}/${username}`, { method: 'DELETE' }),
  storeCredential: (body: Record<string, unknown>) =>
    request('/api/credentials', { method: 'POST', body: JSON.stringify(body) }),
  createSteelSession: (body: Record<string, unknown>) =>
    request('/api/byok/steel/session', { method: 'POST', body: JSON.stringify(body) }),
  importResume: (file: File): Promise<ResumeImportResponse> => {
    const fd = new FormData()
    fd.append('file', file)
    const send = async () => {
      const authToken = authTokenResolver ? await authTokenResolver() : null
      const headers = new Headers()
      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`)
      }
      return fetch(`${API_BASE}/api/profile/import-resume`, {
        method: 'POST',
        body: fd,
        headers,
      })
    }
    return send().then(async (r) => {
      if (!r.ok) {
        const text = await r.text()
        const message = parseErrorMessage(r, text)
        throw new ApiError({
          message,
          status: r.status,
          path: '/api/profile/import-resume',
          hint: buildErrorHint(r.status, message),
          rawBody: text,
        })
      }
      return r.json()
    })
  },
  profilePhotoUrl: (path: string) =>
    `${API_BASE}/api/profile/photo?path=${encodeURIComponent(path)}`,
}

export function subscribeToRunEvents(
  runId: string,
  onEvent: (event: RunEvent) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/api/runs/${runId}/events`)

  eventSource.addEventListener('run_event', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data)
      onEvent(data)
    } catch (e) {
      console.error('Failed to parse event:', e)
    }
  })

  eventSource.onerror = onError || (() => console.error('EventSource error'))

  return () => eventSource.close()
}

export function eventsUrl(runId: string): string {
  return `${API_BASE}/api/runs/${runId}/events`
}
