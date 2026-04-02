-- Add configurable schedule day and time to weekly_report_settings
-- Default: Monday at 08:00 (PKT) — matches the original hardcoded schedule

ALTER TABLE weekly_report_settings
  ADD COLUMN IF NOT EXISTS schedule_day TEXT NOT NULL DEFAULT 'Monday',
  ADD COLUMN IF NOT EXISTS schedule_time TEXT NOT NULL DEFAULT '08:00';
