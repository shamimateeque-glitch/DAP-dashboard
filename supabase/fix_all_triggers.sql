-- =============================================
-- FIX ALL BROKEN TRIGGERS & FUNCTIONS
-- =============================================
-- Case status flow: IN_HAND → UPLOADED → APPROVED → IN_DEPTH → ENFORCEMENT → DESTRUCTION → CLOSED
-- Final Report and Invoice are DECOUPLED from case status (no triggers for them)

-- =============================================
-- STEP 1: Drop invoice & final report status triggers (decoupled from case status)
-- =============================================
DROP TRIGGER IF EXISTS trigger_invoice_status_update ON invoices;
DROP FUNCTION IF EXISTS update_case_status_on_invoice();

DROP TRIGGER IF EXISTS trigger_final_report_status_update ON final_reports;
DROP FUNCTION IF EXISTS update_case_status_on_final_report();

-- =============================================
-- STEP 2: Fix Enforcement status trigger function
-- =============================================
CREATE OR REPLACE FUNCTION update_case_status_on_enforcement()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF NEW.status = 'IN_PROGRESS' THEN
      IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'IN_PROGRESS') THEN
        UPDATE cases SET case_status = 'ENFORCEMENT', updated_at = now()
        WHERE id = NEW.case_id AND case_status NOT IN ('DESTRUCTION', 'CLOSED');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'update_case_status_on_enforcement failed for case %: %', NEW.case_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 3: Fix In-Depth status trigger function
-- =============================================
CREATE OR REPLACE FUNCTION update_case_status_on_indepth()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF NEW.status = 'IN_PROGRESS' THEN
      IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'IN_PROGRESS') THEN
        UPDATE cases SET case_status = 'IN_DEPTH', updated_at = now()
        WHERE id = NEW.case_id AND case_status IN ('APPROVED', 'UPLOADED');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'update_case_status_on_indepth failed for case %: %', NEW.case_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 4: Fix trigger_workflow_alerts() — target_date → due_date
-- =============================================
CREATE OR REPLACE FUNCTION trigger_workflow_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Check for completion (Status: DONE)
  IF NEW.status = 'DONE' AND OLD.status IS DISTINCT FROM 'DONE' THEN
    BEGIN
      IF TG_TABLE_NAME = 'in_depth_stages' THEN
        PERFORM notify_edge_function('IN_DEPTH_DONE', NEW.case_id);
      ELSIF TG_TABLE_NAME = 'enforcement_stages' THEN
        PERFORM notify_edge_function('ENFORCEMENT_DONE', NEW.case_id);
      ELSIF TG_TABLE_NAME = 'destruction_stages' THEN
        PERFORM notify_edge_function('DESTRUCTION_DONE', NEW.case_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Workflow completion alert failed for % on case %: %', TG_TABLE_NAME, NEW.case_id, SQLERRM;
    END;
  END IF;

  -- 2. Check for date changes (all tables now use 'due_date')
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

-- =============================================
-- STEP 5: Ensure triggers are correctly applied
-- =============================================

-- In-Depth status update
DROP TRIGGER IF EXISTS trigger_indepth_status_update ON in_depth_stages;
CREATE TRIGGER trigger_indepth_status_update
  AFTER INSERT OR UPDATE OF status ON in_depth_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_case_status_on_indepth();

-- Enforcement status update
DROP TRIGGER IF EXISTS trigger_enforcement_status_update ON enforcement_stages;
CREATE TRIGGER trigger_enforcement_status_update
  AFTER INSERT OR UPDATE OF status ON enforcement_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_case_status_on_enforcement();

-- Workflow alert triggers (AFTER UPDATE only — not on INSERT)
DROP TRIGGER IF EXISTS alert_indepth_trigger ON in_depth_stages;
DROP TRIGGER IF EXISTS alert_enforcement_trigger ON enforcement_stages;
DROP TRIGGER IF EXISTS alert_destruction_trigger ON destruction_stages;
CREATE TRIGGER alert_indepth_trigger AFTER UPDATE ON in_depth_stages FOR EACH ROW EXECUTE FUNCTION trigger_workflow_alerts();
CREATE TRIGGER alert_enforcement_trigger AFTER UPDATE ON enforcement_stages FOR EACH ROW EXECUTE FUNCTION trigger_workflow_alerts();
CREATE TRIGGER alert_destruction_trigger AFTER UPDATE ON destruction_stages FOR EACH ROW EXECUTE FUNCTION trigger_workflow_alerts();
