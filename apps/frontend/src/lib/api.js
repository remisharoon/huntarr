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
    getRun: (id) => request(`/api/runs/${id}`),
    getRunEvents: (id, limit = 50, afterId = 0) => request(`/api/runs/${id}/events/batch?limit=${limit}&after_id=${afterId}`),
    getRunApplications: (id) => request('/api/applications').then((res) => ({
        items: res.items.filter((app) => app.run_id === id),
    })),
    getRunManualActions: (id) => request('/api/manual-actions').then((res) => ({
        items: res.items.filter((action) => action.run_id === id),
    })),
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
    deleteSchedule: (id) => request(`/api/schedules/${id}`, { method: 'DELETE' }),
    listCredentials: () => request('/api/credentials'),
    getCredential: (domain, username) => request(`/api/credentials/${domain}/${username}`),
    deleteCredential: (domain, username) => request(`/api/credentials/${domain}/${username}`, { method: 'DELETE' }),
    storeCredential: (body) => request('/api/credentials', { method: 'POST', body: JSON.stringify(body) }),
};
export function subscribeToRunEvents(runId, onEvent, onError) {
    const eventSource = new EventSource(`${API_BASE}/api/runs/${runId}/events`);
    eventSource.addEventListener('run_event', (event) => {
        try {
            const data = JSON.parse(event.data);
            onEvent(data);
        }
        catch (e) {
            console.error('Failed to parse event:', e);
        }
    });
    eventSource.onerror = onError || (() => console.error('EventSource error'));
    return () => eventSource.close();
}
export function eventsUrl(runId) {
    return `${API_BASE}/api/runs/${runId}/events`;
}
