CREATE TABLE IF NOT EXISTS aqua_workspaces (
  workspace_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aqua_tanks (
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  tank_id text NOT NULL,
  name text NOT NULL,
  tank_type text NOT NULL,
  data jsonb NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_key,tank_id)
);
CREATE INDEX IF NOT EXISTS aqua_tanks_updated_idx ON aqua_tanks(workspace_key,updated_at DESC);

CREATE TABLE IF NOT EXISTS aqua_push_subscriptions (
  id bigserial PRIMARY KEY,
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  endpoint text NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_key,endpoint)
);

CREATE TABLE IF NOT EXISTS aqua_media_assets (
  id text PRIMARY KEY,
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  tank_id text NOT NULL,
  livestock_id text,
  kind text NOT NULL DEFAULT 'photo',
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aqua_media_tank_idx ON aqua_media_assets(workspace_key,tank_id,created_at DESC);

CREATE TABLE IF NOT EXISTS aqua_ai_audit (
  id bigserial PRIMARY KEY,
  workspace_key text NOT NULL REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  tank_id text,
  mode text NOT NULL,
  question text,
  provider text NOT NULL,
  model text,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aqua_ai_audit_idx ON aqua_ai_audit(workspace_key,created_at DESC);

CREATE TABLE IF NOT EXISTS aqua_job_runs (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL,
  status text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
