-- Weekly Auto Email: settings + logs tables
-- ============================================================

-- 1. Settings table — one row per report type
CREATE TABLE IF NOT EXISTS weekly_report_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL UNIQUE,
  email_addresses TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed all 7 report types
INSERT INTO weekly_report_settings (report_type, email_addresses, is_enabled) VALUES
  ('upload',       '', false),
  ('decision',     '', false),
  ('in-depth',     '', false),
  ('enforcement',  '', false),
  ('final-report', '', false),
  ('invoices',     '', false),
  ('destruction',  '', false)
ON CONFLICT (report_type) DO NOTHING;

-- 2. Email logs table
CREATE TABLE IF NOT EXISTS weekly_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  email_addresses TEXT,
  row_count INT DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_status VARCHAR(20) DEFAULT 'SENT',
  error_message TEXT
);

-- 3. RLS
ALTER TABLE weekly_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_email_logs ENABLE ROW LEVEL SECURITY;

-- Settings: authenticated users can read; super admins can update
CREATE POLICY "weekly_report_settings_read"
  ON weekly_report_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "weekly_report_settings_update"
  ON weekly_report_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Logs: authenticated users can read
CREATE POLICY "weekly_email_logs_read"
  ON weekly_email_logs FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert logs (edge function uses service role key)
CREATE POLICY "weekly_email_logs_insert_service"
  ON weekly_email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
