-- Add is_read column to alert_logs for notification badge tracking
ALTER TABLE alert_logs ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Index for fast unread count queries
CREATE INDEX IF NOT EXISTS idx_alert_logs_unread ON alert_logs (recipient_id, is_read) WHERE is_read = false;
