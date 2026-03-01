const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

export const api = {
  listRuns: () => request<{ items: any[] }>('/api/runs'),
  createRun: (body: Record<string, unknown>) =>
    request('/api/runs', { method: 'POST', body: JSON.stringify(body) }),
  pauseRun: (id: string) => request(`/api/runs/${id}/pause`, { method: 'POST' }),
  resumeRun: (id: string) => request(`/api/runs/${id}/resume`, { method: 'POST' }),
  listJobs: () => request<{ items: any[] }>('/api/jobs'),
  getJob: (id: string) => request(`/api/jobs/${id}`),
  getJobDetail: (id: string) => request(`/api/jobs/${id}`),
  applyNow: (id: string) => request(`/api/jobs/${id}/apply-now`, { method: 'POST' }),
  listApplications: () => request<{ items: any[] }>('/api/applications'),
  getApplicationDetail: (id: string) => request(`/api/applications/${id}`),
  listManualActions: () => request<{ items: any[] }>('/api/manual-actions'),
  startManualSession: (id: string) => request(`/api/manual-actions/${id}/start-session`, { method: 'POST' }),
  resolveManualAction: (id: string) =>
    request(`/api/manual-actions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status: 'resolved', details: { source: 'ui' } }),
    }),
  getProfile: () => request('/api/profile'),
  saveProfile: (body: Record<string, unknown>) =>
    request('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
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
}

export function eventsUrl(runId: string): string {
  return `${API_BASE}/api/runs/${runId}/events`
}
