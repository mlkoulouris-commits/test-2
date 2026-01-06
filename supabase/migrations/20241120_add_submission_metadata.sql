-- Add submission metadata fields to employee_income_reports table
-- This tracks browser, device, IP, and geolocation data for audit purposes

ALTER TABLE employee_income_reports
ADD COLUMN submission_metadata JSONB;

-- Create an index on submission_metadata for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_income_reports_submission_metadata 
  ON employee_income_reports USING gin(submission_metadata);

-- Add comment explaining the structure
COMMENT ON COLUMN employee_income_reports.submission_metadata IS 
'Stores submission metadata including: browser, device, ip_address, user_agent, screen_resolution, timezone, language, platform, geolocation (latitude, longitude, accuracy)';





































