CREATE TABLE IF NOT EXISTS aqua_push_state (
  workspace_key text PRIMARY KEY REFERENCES aqua_workspaces(workspace_key) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'ar',
  tanks jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aqua_push_state_updated_idx ON aqua_push_state(updated_at DESC);
