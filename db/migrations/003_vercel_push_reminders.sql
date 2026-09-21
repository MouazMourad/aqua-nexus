ALTER TABLE aqua_push_state
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS aqua_push_state_notification_idx
  ON aqua_push_state(last_notified_at,updated_at);
