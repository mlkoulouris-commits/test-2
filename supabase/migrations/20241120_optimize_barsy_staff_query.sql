-- Create a function to efficiently get unique Barsy staff
-- This replaces the slow client-side filtering approach

CREATE OR REPLACE FUNCTION get_unique_barsy_staff()
RETURNS TABLE (
  user_name TEXT,
  barsy_user_id INTEGER
) 
LANGUAGE SQL
STABLE
AS $$
  SELECT DISTINCT ON (user_name) 
    user_name,
    barsy_user_id
  FROM barsy_orders
  WHERE user_name IS NOT NULL
  ORDER BY user_name, barsy_user_id DESC;
$$;

-- Add an index on user_name if it doesn't exist to speed up the query
CREATE INDEX IF NOT EXISTS idx_barsy_orders_user_name 
  ON barsy_orders(user_name) 
  WHERE user_name IS NOT NULL;





































