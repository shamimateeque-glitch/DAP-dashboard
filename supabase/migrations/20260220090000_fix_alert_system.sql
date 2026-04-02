-- =============================================
-- FIX: Alert system — broken notify_edge_function()
-- =============================================
-- ROOT CAUSE: notify_edge_function() used current_setting('request.jwt.claims')
-- to build the edge function URL. This only works during HTTP requests, NOT
-- inside database triggers. In trigger context it returns NULL, so the HTTP
-- call silently fails (swallowed by EXCEPTION WHEN OTHERS).
--
-- FIX: Hardcode the Supabase URL and service role key directly in the function.
-- This is the recommended approach for Supabase managed PostgreSQL.
--
-- ACTION REQUIRED: Replace <YOUR_SERVICE_ROLE_KEY> below with the real value
-- from Supabase Dashboard > Settings > API > service_role (secret).
-- =============================================

-- 1. Ensure pg_net is available (required for net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Rewrite notify_edge_function() with hardcoded URL and service role key
CREATE OR REPLACE FUNCTION notify_edge_function(alert_type TEXT, case_id UUID)
RETURNS VOID AS $$
DECLARE
  _url TEXT := 'https://pweaykxbkbqwlxokdbci.supabase.co/functions/v1/send-alert';
  _key TEXT := '<YOUR_SERVICE_ROLE_KEY>';
BEGIN
  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body := jsonb_build_object(
      'type', alert_type,
      'case_id', case_id
    )
  );
END;
$$ LANGUAGE plpgsql;
