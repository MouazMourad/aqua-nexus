CREATE TABLE IF NOT EXISTS aqua_rate_limits (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aqua_rate_limits_reset_idx
  ON aqua_rate_limits(reset_at);
