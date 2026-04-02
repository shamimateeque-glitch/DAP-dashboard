-- Fix the trigger_workflow_alerts function to handle different date column names
-- The 'destruction_stages' table uses 'due_date' instead of 'target_date'

CREATE OR REPLACE FUNCTION trigger_workflow_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Check for completion (Status: DONE)
  IF NEW.status = 'DONE' AND OLD.status IS DISTINCT FROM 'DONE' THEN
    IF TG_TABLE_NAME = 'in_depth_stages' THEN
      PERFORM notify_edge_function('IN_DEPTH_DONE', NEW.case_id);
    ELSIF TG_TABLE_NAME = 'enforcement_stages' THEN
      PERFORM notify_edge_function('ENFORCEMENT_DONE', NEW.case_id);
    ELSIF TG_TABLE_NAME = 'destruction_stages' THEN
      PERFORM notify_edge_function('DESTRUCTION_DONE', NEW.case_id);
    END IF;
  END IF;

  -- 2. Check for date changes
  -- Handle 'target_date' for In-Depth and Enforcement
  IF TG_TABLE_NAME IN ('in_depth_stages', 'enforcement_stages') THEN
    IF NEW.target_date IS DISTINCT FROM OLD.target_date THEN
      IF TG_TABLE_NAME = 'in_depth_stages' THEN
        PERFORM notify_edge_function('IN_DEPTH_DATE_CHANGED', NEW.case_id);
      ELSE
        PERFORM notify_edge_function('ENFORCEMENT_DATE_CHANGED', NEW.case_id);
      END IF;
    END IF;
  END IF;

  -- Handle 'due_date' for Destruction (if we want an alert for it, otherwise skip)
  IF TG_TABLE_NAME = 'destruction_stages' THEN
    -- If there was a 'DESTRUCTION_DATE_CHANGED' alert type, we'd add it here.
    -- For now, just avoiding the crash by not accessing target_date.
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
