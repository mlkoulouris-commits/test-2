-- Allow multiple income reports per user/location/date
-- This enables staff to submit multiple reports for the same day (e.g., different shifts)

ALTER TABLE employee_income_reports 
DROP CONSTRAINT IF EXISTS unique_employee_location_date;





































