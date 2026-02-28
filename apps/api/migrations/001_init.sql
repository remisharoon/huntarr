CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  location TEXT,
  years_experience INTEGER DEFAULT 0,
  summary TEXT DEFAULT '',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_preferences (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  natural_language_override TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credentials_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  username TEXT NOT NULL,
  salt BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, username)
);

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_job_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  posted_at TIMESTAMPTZ,
  dedupe_hash TEXT NOT NULL,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, source_job_id)
);

CREATE TABLE IF NOT EXISTS job_dedupe_map (
  dedupe_hash TEXT PRIMARY KEY,
  canonical_job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_scores (
  job_id UUID PRIMARY KEY REFERENCES job_postings(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL CHECK (mode IN ('manual','scheduled')),
  status TEXT NOT NULL DEFAULT 'queued',
  current_node TEXT,
  search_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS run_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES run_sessions(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL,
  node TEXT,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run_sessions(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  source_portal TEXT,
  error_code TEXT,
  confirmation_text TEXT,
  artifacts JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_answers (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run_sessions(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES run_sessions(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  path TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_queue (
  id BIGSERIAL PRIMARY KEY,
  queue_name TEXT NOT NULL DEFAULT 'hunt',
  run_id UUID REFERENCES run_sessions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cron_expr TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_dedupe_hash ON job_postings(dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_job_scores_score ON job_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_job_queue_pending ON job_queue(status, available_at);
CREATE INDEX IF NOT EXISTS idx_run_events_run_id_id ON run_events(run_id, id);
CREATE INDEX IF NOT EXISTS idx_manual_actions_status ON manual_actions(status, created_at DESC);
