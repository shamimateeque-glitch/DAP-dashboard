-- Add missing columns to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS case_reported_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS matter_code VARCHAR(100);

-- Create index for better search performance on new columns
CREATE INDEX IF NOT EXISTS idx_cases_reported_by ON cases(case_reported_by);
CREATE INDEX IF NOT EXISTS idx_cases_matter_code ON cases(matter_code);
