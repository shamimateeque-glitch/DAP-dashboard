-- =============================================
-- PHASE 5: ALERTS & REMINDERS - DATABASE SETUP
-- =============================================

-- Enable pg_net extension if not enabled (required for calling Edge Functions from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Helper function to call the send-alert Edge Function
-- Hardcoded URL + service role key (required for trigger context where JWT claims are unavailable)
-- Replace <YOUR_SERVICE_ROLE_KEY> with your actual service role key
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

-- 2. Trigger Function for Workflow Stages (with exception handling)
CREATE OR REPLACE FUNCTION trigger_workflow_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for completion
  IF NEW.status = 'DONE' AND OLD.status = 'IN_PROGRESS' THEN
    BEGIN
      IF TG_TABLE_NAME = 'in_depth_stages' THEN
        PERFORM notify_edge_function('IN_DEPTH_DONE', NEW.case_id);
      ELSIF TG_TABLE_NAME = 'enforcement_stages' THEN
        PERFORM notify_edge_function('ENFORCEMENT_DONE', NEW.case_id);
      ELSIF TG_TABLE_NAME = 'destruction_stages' THEN
        PERFORM notify_edge_function('DESTRUCTION_DONE', NEW.case_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Workflow alert failed for % on case %: %', TG_TABLE_NAME, NEW.case_id, SQLERRM;
    END;
  END IF;

  -- Check for date changes (column renamed from target_date to due_date)
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    BEGIN
      IF TG_TABLE_NAME = 'in_depth_stages' THEN
        PERFORM notify_edge_function('IN_DEPTH_DATE_CHANGED', NEW.case_id);
      ELSIF TG_TABLE_NAME = 'enforcement_stages' THEN
        PERFORM notify_edge_function('ENFORCEMENT_DATE_CHANGED', NEW.case_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Workflow date-change alert failed for % on case %: %', TG_TABLE_NAME, NEW.case_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger Function for Invoices (with exception handling)
CREATE OR REPLACE FUNCTION trigger_invoice_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- New Invoice
  IF TG_OP = 'INSERT' THEN
    BEGIN
      PERFORM notify_edge_function('INVOICE_ISSUED', NEW.case_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Invoice alert (ISSUED) failed for case %: %', NEW.case_id, SQLERRM;
    END;
  END IF;

  -- Paid Invoice
  IF TG_OP = 'UPDATE' AND NEW.status = 'PAID' AND OLD.status != 'PAID' THEN
    BEGIN
      PERFORM notify_edge_function('INVOICE_PAID', NEW.case_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Invoice alert (PAID) failed for case %: %', NEW.case_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply Triggers
-- Workflow Triggers
DROP TRIGGER IF EXISTS alert_indepth_trigger ON in_depth_stages;
DROP TRIGGER IF EXISTS alert_enforcement_trigger ON enforcement_stages;
DROP TRIGGER IF EXISTS alert_destruction_trigger ON destruction_stages;
CREATE TRIGGER alert_indepth_trigger AFTER UPDATE ON in_depth_stages FOR EACH ROW EXECUTE FUNCTION trigger_workflow_alerts();
CREATE TRIGGER alert_enforcement_trigger AFTER UPDATE ON enforcement_stages FOR EACH ROW EXECUTE FUNCTION trigger_workflow_alerts();
CREATE TRIGGER alert_destruction_trigger AFTER UPDATE ON destruction_stages FOR EACH ROW EXECUTE FUNCTION trigger_workflow_alerts();

-- Invoice Triggers
DROP TRIGGER IF EXISTS alert_invoice_insert_trigger ON invoices;
DROP TRIGGER IF EXISTS alert_invoice_update_trigger ON invoices;
CREATE TRIGGER alert_invoice_insert_trigger AFTER INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION trigger_invoice_alerts();
CREATE TRIGGER alert_invoice_update_trigger AFTER UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION trigger_invoice_alerts();

-- Final Report Trigger (with exception handling)
CREATE OR REPLACE FUNCTION trigger_final_report_alert()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    PERFORM notify_edge_function('FINAL_REPORT_SUBMITTED', NEW.case_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Final report alert failed for case %: %', NEW.case_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alert_final_report_trigger ON final_reports;
CREATE TRIGGER alert_final_report_trigger AFTER INSERT ON final_reports FOR EACH ROW EXECUTE FUNCTION trigger_final_report_alert();

-- Scheduled Reminders Note:
-- You should use the 'pg_cron' extension to call the 'daily-reminders' function once a day.
-- Example:
-- SELECT cron.schedule('0 0 * * *', $$ SELECT net.http_post('https://<PROJECT_REF>.supabase.co/functions/v1/daily-reminders') $$);
