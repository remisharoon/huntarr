export interface Run {
  id: string
  mode: 'manual' | 'scheduled'
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed'
  current_node: string | null
  search_config: SearchConfig
  state_json: Record<string, any>
  metrics: RunMetrics
  error: string | null
  started_at: string | null
  updated_at: string
  completed_at: string | null
}

export interface RunMetrics {
  discovered?: number
  applied: number
  failed: number
  manual_required: number
  skipped: number
}

export interface SearchConfig {
  role_keywords?: string[]
  exclude_keywords?: string[]
  locations?: string[]
  remote_only?: boolean
  salary_min?: number
  salary_max?: number
  aggressive_scraping?: boolean
  max_jobs_per_run?: number
  target_job_id?: string | null
}

export interface RunEvent {
  id: string
  run_id: string
  level: 'info' | 'warning' | 'error'
  node: string | null
  event_type: string
  message: string
  payload_json: Record<string, any> | null
  created_at: string
}

export interface Application {
  id: string
  run_id: string
  job_id: string
  status: string
  created_at: string
  job: {
    title: string
    company: string
  }
}

export interface ManualAction {
  id: string
  run_id: string
  action_type: string
  status: string
  created_at: string
}