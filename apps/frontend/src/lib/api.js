const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
async function request(path, init) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        ...init,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
    }
    return (await response.json());
}
export const api = {
    listRuns: () => request('/api/runs'),
    createRun: (body) => request('/api/runs', { method: 'POST', body: JSON.stringify(body) }),
    pauseRun: (id) => request(`/api/runs/${id}/pause`, { method: 'POST' }),
    resumeRun: (id) => request(`/api/runs/${id}/resume`, { method: 'POST' }),
    listJobs: () => request('/api/jobs'),
    getJob: (id) => request(`/api/jobs/${id}`),
    getJobDetail: (id) => request(`/api/jobs/${id}`),
    applyNow: (id) => request(`/api/jobs/${id}/apply-now`, { method: 'POST' }),
    listApplications: () => request('/api/applications'),
    getApplicationDetail: (id) => request(`/api/applications/${id}`),
    listManualActions: () => request('/api/manual-actions'),
    startManualSession: (id) => request(`/api/manual-actions/${id}/start-session`, { method: 'POST' }),
    resolveManualAction: (id) => request(`/api/manual-actions/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status: 'resolved', details: { source: 'ui' } }),
    }),
    getProfile: () => request('/api/profile'),
    saveProfile: (body) => request('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
    getConfig: () => request('/api/config'),
    putConfig: (value) => request('/api/config', { method: 'PUT', body: JSON.stringify({ value }) }),
    listSchedules: () => request('/api/schedules'),
    createSchedule: (body) => request('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),
    storeCredential: (body) => request('/api/credentials', { method: 'POST', body: JSON.stringify(body) }),
};
export function eventsUrl(runId) {
    return `${API_BASE}/api/runs/${runId}/events`;
}
