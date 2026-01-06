-- Remove unique constraint to allow multiple reports per employee/location/day
-- This allows employees to submit multiple reports in a day (e.g., different shifts)

ALTER TABLE employee_income_reports
DROP CONSTRAINT IF EXISTS unique_employee_location_date;


