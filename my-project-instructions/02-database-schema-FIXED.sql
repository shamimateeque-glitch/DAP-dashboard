-- =============================================
-- OPERATIONS MANAGEMENT APPLICATION
-- Complete Database Creation Script for Supabase
-- Version 1.0
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUM TYPES
-- =============================================

-- User roles
CREATE TYPE user_role_enum AS ENUM ('SUPER_ADMIN', 'DATA_ENTRY', 'VIEW_ONLY');

-- Case statuses
CREATE TYPE case_status_enum AS ENUM ('IN_HAND', 'UPLOADED', 'APPROVED', 'REJECTED', 'CLOSED');

-- Clients
CREATE TYPE client_enum AS ENUM ('ONEWORLD', 'AA', 'SAFEMARK');

-- Client decision
CREATE TYPE decision_status_enum AS ENUM ('APPROVED', 'REJECTED');

-- Workflow stage status
CREATE TYPE workflow_status_enum AS ENUM ('IN_PROGRESS', 'DONE');

-- Invoice status
CREATE TYPE invoice_status_enum AS ENUM ('ISSUED', 'PAID', 'NOT_PAID');

-- Alert types
CREATE TYPE alert_type_enum AS ENUM (
  'CASE_APPROVED', 
  'CASE_REJECTED',
  'IN_DEPTH_DONE', 
  'IN_DEPTH_DATE_CHANGED',
  'ENFORCEMENT_DONE', 
  'ENFORCEMENT_DATE_CHANGED',
  'DESTRUCTION_DONE',
  'FINAL_REPORT_SUBMITTED',
  'INVOICE_ISSUED', 
  'INVOICE_PAID', 
  'INVOICE_OVERDUE'
);

-- Reminder types
CREATE TYPE reminder_type_enum AS ENUM (
  'IN_DEPTH_DUE', 
  'ENFORCEMENT_DUE', 
  'INVOICE_DUE'
);

-- =============================================
-- TABLES
-- =============================================

-- ---------------------------------------------
-- Users Table (extends Supabase Auth)
-- ---------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'VIEW_ONLY',
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{
    "cases": { "view": true, "create": false, "edit": false },
    "workflow": { "view": true, "edit": false },
    "invoices": { "view": true, "edit": false },
    "reports": { "view": true, "export": false },
    "admin": { "users": false, "settings": false }
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- Cases Table (Core Entity)
-- ---------------------------------------------
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(20) UNIQUE NOT NULL,
  target_name VARCHAR(255) NOT NULL,
  target_category VARCHAR(100) NOT NULL,
  target_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  brand_name VARCHAR(255) NOT NULL,
  products_name TEXT NOT NULL,
  case_submitted_date DATE NOT NULL,
  case_submitted_by VARCHAR(255) NOT NULL,
  notes_description TEXT,
  case_status case_status_enum DEFAULT 'IN_HAND',
  closed_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- Case Uploads Table (Step 2: Upload to Client)
-- ---------------------------------------------
CREATE TABLE case_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client client_enum NOT NULL,
  upload_date DATE NOT NULL,
  our_fee_usd DECIMAL(10,2) NOT NULL,
  decision_status decision_status_enum,
  decision_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- In-Depth Stage Table (Step 5)
-- ---------------------------------------------
CREATE TABLE in_depth_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  status workflow_status_enum DEFAULT 'IN_PROGRESS',
  status_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- Enforcement Stage Table (Step 6)
-- ---------------------------------------------
CREATE TABLE enforcement_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  status workflow_status_enum DEFAULT 'IN_PROGRESS',
  status_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- Final Reports Table (Step 7)
-- ---------------------------------------------
CREATE TABLE final_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  submission_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- Invoices Table (Step 8)
-- ---------------------------------------------
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status invoice_status_enum DEFAULT 'ISSUED',
  status_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- Destruction Stage Table (Step 9)
-- ---------------------------------------------
CREATE TABLE destruction_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status workflow_status_enum DEFAULT 'IN_PROGRESS',
  status_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- ---------------------------------------------
-- Case Notes Table
-- ---------------------------------------------
CREATE TABLE case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------
-- Alert Configuration Table
-- ---------------------------------------------
CREATE TABLE alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type alert_type_enum NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(alert_type, user_id)
);

-- ---------------------------------------------
-- Alert Logs Table
-- ---------------------------------------------
CREATE TABLE alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type alert_type_enum NOT NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  recipient_id UUID NOT NULL REFERENCES users(id),
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_status VARCHAR(20) DEFAULT 'SENT'
);

-- ---------------------------------------------
-- Reminder Configuration Table
-- ---------------------------------------------
CREATE TABLE reminder_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_type reminder_type_enum NOT NULL,
  days_offset INTEGER NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_days INTEGER,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------
-- Reminder Logs Table
-- ---------------------------------------------
CREATE TABLE reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_type reminder_type_enum NOT NULL,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  email_status VARCHAR(20) DEFAULT 'PENDING'
);

-- ---------------------------------------------
-- System Settings Table
-- ---------------------------------------------
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);

-- =============================================
-- INDEXES
-- =============================================

-- Cases indexes
CREATE INDEX idx_cases_status ON cases(case_status);
CREATE INDEX idx_cases_submitted_date ON cases(case_submitted_date DESC);
CREATE INDEX idx_cases_brand ON cases(brand_name);
CREATE INDEX idx_cases_province ON cases(province);
CREATE INDEX idx_cases_city ON cases(city);
CREATE INDEX idx_cases_closed_date ON cases(closed_date DESC);

-- Case Uploads indexes
CREATE INDEX idx_uploads_client ON case_uploads(client);
CREATE INDEX idx_uploads_decision ON case_uploads(decision_status);
CREATE INDEX idx_uploads_decision_date ON case_uploads(decision_date);

-- Workflow stage indexes
CREATE INDEX idx_indepth_status ON in_depth_stages(status);
CREATE INDEX idx_indepth_target ON in_depth_stages(target_date);
CREATE INDEX idx_enforcement_status ON enforcement_stages(status);
CREATE INDEX idx_enforcement_target ON enforcement_stages(target_date);
CREATE INDEX idx_destruction_status ON destruction_stages(status);
CREATE INDEX idx_destruction_due ON destruction_stages(due_date);

-- Invoice indexes
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);
CREATE INDEX idx_invoices_issue ON invoices(issue_date);

-- Case Notes index
CREATE INDEX idx_notes_case ON case_notes(case_id, created_at DESC);

-- Users index
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to generate Case ID
CREATE OR REPLACE FUNCTION generate_case_id()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_case_id TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(case_id FROM 'CASE-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM cases
  WHERE case_id LIKE 'CASE-' || year_part || '-%';
  
  new_case_id := 'CASE-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  NEW.case_id := new_case_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating Case ID
CREATE TRIGGER trigger_generate_case_id
  BEFORE INSERT ON cases
  FOR EACH ROW
  WHEN (NEW.case_id IS NULL)
  EXECUTE FUNCTION generate_case_id();

-- Function to generate Invoice Number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  new_invoice_number TEXT;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'INV-\d{4}-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_part || '-%';
  
  new_invoice_number := 'INV-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  NEW.invoice_number := new_invoice_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generating Invoice Number
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- Function to update case status when uploaded
CREATE OR REPLACE FUNCTION update_case_status_on_upload()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cases 
  SET case_status = 'UPLOADED', updated_at = now()
  WHERE id = NEW.case_id AND case_status = 'IN_HAND';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_case_uploaded
  AFTER INSERT ON case_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_case_status_on_upload();

-- Function to update case status on client decision
CREATE OR REPLACE FUNCTION update_case_status_on_decision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.decision_status = 'APPROVED' THEN
    UPDATE cases 
    SET case_status = 'APPROVED', updated_at = now()
    WHERE id = NEW.case_id;
  ELSIF NEW.decision_status = 'REJECTED' THEN
    UPDATE cases 
    SET case_status = 'REJECTED', closed_date = NEW.decision_date, updated_at = now()
    WHERE id = NEW.case_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_case_decision
  AFTER UPDATE OF decision_status ON case_uploads
  FOR EACH ROW
  WHEN (OLD.decision_status IS DISTINCT FROM NEW.decision_status)
  EXECUTE FUNCTION update_case_status_on_decision();

-- Function to auto-close case when destruction is done
CREATE OR REPLACE FUNCTION auto_close_case_on_destruction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'DONE' AND OLD.status = 'IN_PROGRESS' THEN
    UPDATE cases 
    SET case_status = 'CLOSED', closed_date = CURRENT_DATE, updated_at = now()
    WHERE id = NEW.case_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_destruction_done
  AFTER UPDATE OF status ON destruction_stages
  FOR EACH ROW
  EXECUTE FUNCTION auto_close_case_on_destruction();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON case_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_indepth_updated_at BEFORE UPDATE ON in_depth_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_enforcement_updated_at BEFORE UPDATE ON enforcement_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_destruction_updated_at BEFORE UPDATE ON destruction_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_depth_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcement_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE destruction_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM users WHERE auth_user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(area TEXT, action TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (permissions->area->>action)::boolean,
    false
  )
  FROM users 
  WHERE auth_user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- POLICIES FOR CASES TABLE
-- =============================================

-- Super Admin: Full access
CREATE POLICY cases_super_admin_all ON cases
  FOR ALL
  USING (get_current_user_role() = 'SUPER_ADMIN');

-- Data Entry: View if has permission
CREATE POLICY cases_data_entry_select ON cases
  FOR SELECT
  USING (
    get_current_user_role() = 'DATA_ENTRY' 
    AND has_permission('cases', 'view')
  );

-- Data Entry: Insert if has permission
CREATE POLICY cases_data_entry_insert ON cases
  FOR INSERT
  WITH CHECK (
    get_current_user_role() = 'DATA_ENTRY' 
    AND has_permission('cases', 'create')
  );

-- Data Entry: Update if has permission
CREATE POLICY cases_data_entry_update ON cases
  FOR UPDATE
  USING (
    get_current_user_role() = 'DATA_ENTRY' 
    AND has_permission('cases', 'edit')
  );

-- View Only: Read only if has permission
CREATE POLICY cases_view_only_select ON cases
  FOR SELECT
  USING (
    get_current_user_role() = 'VIEW_ONLY' 
    AND has_permission('cases', 'view')
  );

-- =============================================
-- POLICIES FOR OTHER TABLES (Similar pattern)
-- =============================================

-- Case Uploads
CREATE POLICY uploads_super_admin_all ON case_uploads FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY uploads_data_entry_select ON case_uploads FOR SELECT USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('cases', 'view'));
CREATE POLICY uploads_data_entry_insert ON case_uploads FOR INSERT WITH CHECK (get_current_user_role() = 'DATA_ENTRY' AND has_permission('cases', 'create'));
CREATE POLICY uploads_data_entry_update ON case_uploads FOR UPDATE USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('cases', 'edit'));
CREATE POLICY uploads_view_only_select ON case_uploads FOR SELECT USING (get_current_user_role() = 'VIEW_ONLY' AND has_permission('cases', 'view'));

-- In-Depth Stages
CREATE POLICY indepth_super_admin_all ON in_depth_stages FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY indepth_data_entry_select ON in_depth_stages FOR SELECT USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'view'));
CREATE POLICY indepth_data_entry_modify ON in_depth_stages FOR ALL USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'edit'));
CREATE POLICY indepth_view_only_select ON in_depth_stages FOR SELECT USING (get_current_user_role() = 'VIEW_ONLY' AND has_permission('workflow', 'view'));

-- Enforcement Stages
CREATE POLICY enforcement_super_admin_all ON enforcement_stages FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY enforcement_data_entry_select ON enforcement_stages FOR SELECT USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'view'));
CREATE POLICY enforcement_data_entry_modify ON enforcement_stages FOR ALL USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'edit'));
CREATE POLICY enforcement_view_only_select ON enforcement_stages FOR SELECT USING (get_current_user_role() = 'VIEW_ONLY' AND has_permission('workflow', 'view'));

-- Destruction Stages
CREATE POLICY destruction_super_admin_all ON destruction_stages FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY destruction_data_entry_select ON destruction_stages FOR SELECT USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'view'));
CREATE POLICY destruction_data_entry_modify ON destruction_stages FOR ALL USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'edit'));
CREATE POLICY destruction_view_only_select ON destruction_stages FOR SELECT USING (get_current_user_role() = 'VIEW_ONLY' AND has_permission('workflow', 'view'));

-- Final Reports
CREATE POLICY reports_super_admin_all ON final_reports FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY reports_data_entry_select ON final_reports FOR SELECT USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'view'));
CREATE POLICY reports_data_entry_modify ON final_reports FOR ALL USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('workflow', 'edit'));
CREATE POLICY reports_view_only_select ON final_reports FOR SELECT USING (get_current_user_role() = 'VIEW_ONLY' AND has_permission('workflow', 'view'));

-- Invoices
CREATE POLICY invoices_super_admin_all ON invoices FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY invoices_data_entry_select ON invoices FOR SELECT USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('invoices', 'view'));
CREATE POLICY invoices_data_entry_modify ON invoices FOR ALL USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('invoices', 'edit'));
CREATE POLICY invoices_view_only_select ON invoices FOR SELECT USING (get_current_user_role() = 'VIEW_ONLY' AND has_permission('invoices', 'view'));

-- Case Notes
CREATE POLICY notes_super_admin_all ON case_notes FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY notes_data_entry_select ON case_notes FOR SELECT USING (get_current_user_role() = 'DATA_ENTRY' AND has_permission('cases', 'view'));
CREATE POLICY notes_data_entry_insert ON case_notes FOR INSERT WITH CHECK (get_current_user_role() = 'DATA_ENTRY' AND has_permission('cases', 'edit'));
CREATE POLICY notes_view_only_select ON case_notes FOR SELECT USING (get_current_user_role() = 'VIEW_ONLY' AND has_permission('cases', 'view'));

-- Users (Admin only)
CREATE POLICY users_super_admin_all ON users FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY users_self_select ON users FOR SELECT USING (auth_user_id = auth.uid());

-- System Settings (Admin only)
CREATE POLICY settings_super_admin_all ON system_settings FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY settings_all_select ON system_settings FOR SELECT USING (true);

-- Alert/Reminder Configuration (Admin only for config, self for logs)
CREATE POLICY alert_config_super_admin ON alert_configurations FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY alert_logs_super_admin ON alert_logs FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY reminder_config_super_admin ON reminder_configurations FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');
CREATE POLICY reminder_logs_super_admin ON reminder_logs FOR ALL USING (get_current_user_role() = 'SUPER_ADMIN');

-- =============================================
-- SEED DATA
-- =============================================

-- Default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('in_depth_default_days', '7', 'Default days after approval for In-Depth target date'),
  ('enforcement_default_days', '7', 'Default days after In-Depth for Enforcement target date'),
  ('invoice_due_days', '60', 'Default days after issue for invoice due date'),
  ('case_id_prefix', '"CASE"', 'Prefix for auto-generated case IDs'),
  ('invoice_id_prefix', '"INV"', 'Prefix for auto-generated invoice numbers');

-- Default reminder configurations
INSERT INTO reminder_configurations (reminder_type, days_offset, is_recurring, recurrence_days) VALUES
  -- In-Depth reminders
  ('IN_DEPTH_DUE', -2, false, null),  -- 2 days before
  ('IN_DEPTH_DUE', -1, false, null),  -- 1 day before
  ('IN_DEPTH_DUE', 0, false, null),   -- On due date
  -- Enforcement reminders
  ('ENFORCEMENT_DUE', -2, false, null),
  ('ENFORCEMENT_DUE', -1, false, null),
  ('ENFORCEMENT_DUE', 0, false, null),
  -- Invoice reminders
  ('INVOICE_DUE', -15, false, null),  -- 15 days before
  ('INVOICE_DUE', -7, false, null),   -- 7 days before
  ('INVOICE_DUE', 0, false, null),    -- On due date
  ('INVOICE_DUE', 15, true, 15);      -- After due: every 15 days

-- =============================================
-- VIEWS (for common queries)
-- =============================================

-- View: Cases with all related data
CREATE OR REPLACE VIEW cases_full_view AS
SELECT 
  c.*,
  cu.client,
  cu.upload_date,
  cu.our_fee_usd,
  cu.decision_status,
  cu.decision_date,
  ids.target_date as in_depth_target_date,
  ids.status as in_depth_status,
  ids.status_date as in_depth_status_date,
  es.target_date as enforcement_target_date,
  es.status as enforcement_status,
  es.status_date as enforcement_status_date,
  fr.submission_date as final_report_date,
  inv.invoice_number,
  inv.issue_date as invoice_issue_date,
  inv.due_date as invoice_due_date,
  inv.status as invoice_status,
  inv.status_date as invoice_status_date,
  ds.due_date as destruction_due_date,
  ds.status as destruction_status,
  ds.status_date as destruction_status_date
FROM cases c
LEFT JOIN case_uploads cu ON c.id = cu.case_id
LEFT JOIN in_depth_stages ids ON c.id = ids.case_id
LEFT JOIN enforcement_stages es ON c.id = es.case_id
LEFT JOIN final_reports fr ON c.id = fr.case_id
LEFT JOIN invoices inv ON c.id = inv.case_id
LEFT JOIN destruction_stages ds ON c.id = ds.case_id;

-- View: Financial Summary by Client
CREATE OR REPLACE VIEW financial_summary_by_client AS
SELECT 
  cu.client,
  COUNT(DISTINCT c.id) as total_cases,
  COUNT(DISTINCT CASE WHEN cu.decision_status = 'APPROVED' THEN c.id END) as approved_cases,
  COUNT(DISTINCT CASE WHEN cu.decision_status = 'REJECTED' THEN c.id END) as rejected_cases,
  COALESCE(SUM(cu.our_fee_usd), 0) as total_fee_uploaded,
  COALESCE(SUM(CASE WHEN cu.decision_status = 'APPROVED' THEN cu.our_fee_usd END), 0) as fee_approved,
  COALESCE(SUM(CASE WHEN inv.id IS NOT NULL THEN cu.our_fee_usd END), 0) as fee_invoiced,
  COALESCE(SUM(CASE WHEN inv.status = 'PAID' THEN cu.our_fee_usd END), 0) as fee_paid,
  COALESCE(SUM(CASE WHEN inv.status IN ('ISSUED', 'NOT_PAID') THEN cu.our_fee_usd END), 0) as fee_outstanding
FROM case_uploads cu
JOIN cases c ON cu.case_id = c.id
LEFT JOIN invoices inv ON c.id = inv.case_id
GROUP BY cu.client;

-- View: Invoice Aging
CREATE OR REPLACE VIEW invoice_aging AS
SELECT 
  inv.id,
  inv.case_id,
  inv.invoice_number,
  inv.issue_date,
  inv.due_date,
  inv.status,
  inv.status_date,
  inv.created_at,
  inv.updated_at,
  inv.created_by,
  c.case_id as case_display_id,
  c.target_name,
  c.brand_name,
  cu.client,
  cu.our_fee_usd,
  CASE 
    WHEN inv.status = 'PAID' THEN 'PAID'
    WHEN inv.due_date > CURRENT_DATE THEN 'NOT_YET_DUE'
    WHEN inv.due_date = CURRENT_DATE THEN 'DUE_TODAY'
    WHEN CURRENT_DATE - inv.due_date BETWEEN 1 AND 15 THEN 'OVERDUE_1_15'
    WHEN CURRENT_DATE - inv.due_date BETWEEN 16 AND 30 THEN 'OVERDUE_16_30'
    WHEN CURRENT_DATE - inv.due_date BETWEEN 31 AND 60 THEN 'OVERDUE_31_60'
    ELSE 'OVERDUE_60_PLUS'
  END as aging_bucket,
  GREATEST(CURRENT_DATE - inv.due_date, 0) as days_overdue
FROM invoices inv
JOIN cases c ON inv.case_id = c.id
JOIN case_uploads cu ON c.id = cu.case_id;

-- =============================================
-- END OF SCRIPT
-- =============================================
