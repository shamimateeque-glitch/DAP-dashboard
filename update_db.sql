ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_reported_by VARCHAR(255);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS matter_code VARCHAR(255);

-- Step 1: Create a proper sequence (avoids full table scan on every INSERT)
CREATE SEQUENCE IF NOT EXISTS cases_case_id_seq START 1;

-- Step 2: Fast trigger function using the sequence
CREATE OR REPLACE FUNCTION generate_case_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.case_id := LPAD(nextval('cases_case_id_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
