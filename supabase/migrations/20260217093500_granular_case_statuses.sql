-- Migration to add granular case statuses and automatic status updates
-- This addresses the issue where the case status stays "APPROVED" despite workflow progress

-- 1. Add new values to case_status_enum
-- Note: Enum additions cannot be done inside a transaction block in some Postgres versions, 
-- but in Supabase/Postgres 12+ it's generally fine if handled carefully.
ALTER TYPE case_status_enum ADD VALUE IF NOT EXISTS 'IN_DEPTH';
ALTER TYPE case_status_enum ADD VALUE IF NOT EXISTS 'ENFORCEMENT';
ALTER TYPE case_status_enum ADD VALUE IF NOT EXISTS 'FINAL_REPORT';
ALTER TYPE case_status_enum ADD VALUE IF NOT EXISTS 'INVOICED';

-- 2. Create/Update trigger functions for automatic status updates

-- Handler for In-Depth Stage
CREATE OR REPLACE FUNCTION update_case_status_on_indepth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'IN_PROGRESS' AND OLD.status IS DISTINCT FROM 'IN_PROGRESS' THEN
    UPDATE cases SET case_status = 'IN_DEPTH', updated_at = now() 
    WHERE id = NEW.case_id AND case_status IN ('APPROVED', 'UPLOADED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_indepth_status_update ON in_depth_stages;
CREATE TRIGGER trigger_indepth_status_update
  AFTER INSERT OR UPDATE OF status ON in_depth_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_case_status_on_indepth();

-- Handler for Enforcement Stage
CREATE OR REPLACE FUNCTION update_case_status_on_enforcement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'IN_PROGRESS' AND OLD.status IS DISTINCT FROM 'IN_PROGRESS' THEN
    UPDATE cases SET case_status = 'ENFORCEMENT', updated_at = now() 
    WHERE id = NEW.case_id AND case_status NOT IN ('FINAL_REPORT', 'INVOICED', 'CLOSED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforcement_status_update ON enforcement_stages;
CREATE TRIGGER trigger_enforcement_status_update
  AFTER INSERT OR UPDATE OF status ON enforcement_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_case_status_on_enforcement();

-- Handler for Final Report (Insertion only)
CREATE OR REPLACE FUNCTION update_case_status_on_final_report()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cases SET case_status = 'FINAL_REPORT', updated_at = now() 
  WHERE id = NEW.case_id AND case_status NOT IN ('INVOICED', 'CLOSED');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_final_report_status_update ON final_reports;
CREATE TRIGGER trigger_final_report_status_update
  AFTER INSERT ON final_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_case_status_on_final_report();

-- Handler for Invoices (Insertion only)
CREATE OR REPLACE FUNCTION update_case_status_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cases SET case_status = 'INVOICED', updated_at = now() 
  WHERE id = NEW.case_id AND case_status != 'CLOSED';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoice_status_update ON invoices;
CREATE TRIGGER trigger_invoice_status_update
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_case_status_on_invoice();
