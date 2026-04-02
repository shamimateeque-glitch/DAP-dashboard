-- Allow super admins to insert weekly_report_settings (needed for upsert)
CREATE POLICY "weekly_report_settings_insert"
  ON weekly_report_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );
