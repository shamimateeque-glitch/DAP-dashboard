-- Update weekly report cron to run every 30 minutes.
-- The edge function checks schedule_day/schedule_time from the DB
-- and only proceeds when the current PKT day + time matches.
--
-- Previous: '0 3 * * 1' (Monday 3:00 AM UTC only)
-- New:      '0,30 * * * *' (every 30 minutes)

SELECT cron.unschedule('weekly-pending-reports');

SELECT cron.schedule(
  'weekly-pending-reports',
  '0,30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pweaykxbkbqwlxokdbci.supabase.co/functions/v1/weekly-pending-reports',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
