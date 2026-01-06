-- Fix validate_payment_location trigger function
-- The function was using UUID types but location_id columns are now INTEGER
-- This caused "invalid input syntax for type uuid" errors when making payments

CREATE OR REPLACE FUNCTION validate_payment_location()
RETURNS TRIGGER AS $$
DECLARE
  payment_location INTEGER;
  bill_location INTEGER;
BEGIN
  -- Get the location from the payment
  SELECT location_id INTO payment_location
  FROM bill_payments
  WHERE id = NEW.payment_id;
  
  -- Get the location from the bill (using new_bill_id column)
  SELECT location_id INTO bill_location
  FROM bills
  WHERE id = NEW.new_bill_id;
  
  -- Ensure they match
  IF payment_location IS NOT NULL AND bill_location IS NOT NULL THEN
    IF payment_location != bill_location THEN
      RAISE EXCEPTION 'Payment can only be applied to bills from the same location (Location ID: %)', payment_location;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;





































