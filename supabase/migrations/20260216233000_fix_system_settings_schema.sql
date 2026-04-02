-- Recreate system_settings table to ensure schema correctness
DROP TABLE IF EXISTS system_settings CASCADE;

-- Create system_settings table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES users(id)
);

-- Insert default settings
INSERT INTO system_settings (key, value, description)
VALUES 
    ('workflow_defaults', '{"in_depth_days": 7, "enforcement_days": 7, "invoice_due_days": 60}', 'Default days for workflow stages'),
    ('id_prefixes', '{"case": "DAP", "invoice": "INV"}', 'Prefixes for generated IDs'),
    ('company_info', '{"name": "DAP IP", "address": "", "email": "admin@dap-ip.com"}', 'Company information for headers/invoices');

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow super admins to manage settings"
ON system_settings
FOR ALL
USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_user_id = auth.uid()
    AND users.role = 'SUPER_ADMIN'
));

CREATE POLICY "Allow all users to view settings"
ON system_settings
FOR SELECT
USING (true);
