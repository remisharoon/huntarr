export type ThemeMode = 'dark' | 'light' | 'system'

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

export interface RunFilterState {
  status: 'all' | Run['status']
  mode: 'all' | Run['mode']
  query: string
  dateScope: '24h' | '7d' | '30d' | 'all'
}

export type RunSortKey = 'started_at' | 'duration' | 'status'

export type SortDirection = 'asc' | 'desc'

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

export interface ProfileExperience {
  title: string
  company: string
  start: string
  end: string
  description: string
}

export interface ProfileEducation {
  degree: string
  institution: string
  year: string
  description: string
}

export interface ProfileAward {
  title: string
  issuer: string
  year: string
  description: string
}

export interface ProfileCertification {
  name: string
  issuer: string
  year: string
  credential_id: string
  url: string
}

export interface ProfileProject {
  name: string
  role: string
  start: string
  end: string
  description: string
  url: string
  tech_stack: string[]
}

export interface ProfileLanguage {
  name: string
  proficiency: string
}

export interface ProfileLink {
  label: string
  url: string
}

export interface Profile {
  id?: string
  full_name: string
  email: string
  phone?: string | null
  location?: string | null
  years_experience: number
  summary: string
  skills: string[]
  experience: ProfileExperience[]
  education: ProfileEducation[]
  awards: ProfileAward[]
  certifications: ProfileCertification[]
  projects: ProfileProject[]
  languages: ProfileLanguage[]
  links: ProfileLink[]
  profile_photo_path?: string | null
  profile_photo_mime?: string | null
  preferences: Record<string, unknown>
  rule_config?: Record<string, unknown>
  natural_language_override?: string | null
}
