-- Schedule weekly pending reports email: Monday 8:00 AM PKT = Monday 3:00 AM UTC
-- Requires pg_cron and pg_net extensions to be enabled in Supabase Dashboard
--
-- Prerequisites:
--   1. Enable pg_cron and pg_net in Database > Extensions
--   2. Replace <YOUR_SERVICE_ROLE_KEY> with the real value from Settings > API
--
-- To enable extensions:
--   Go to Database > Extensions, search for pg_cron and pg_net, enable both

SELECT cron.schedule(
  'weekly-pending-reports',
  '0 3 * * 1',
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
