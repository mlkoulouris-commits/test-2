-- Insert Barsy Locations Configuration
-- Note: In production, passwords should be properly encrypted

INSERT INTO barsy_locations (name, barsy_url, username, password_encrypted, is_active)
VALUES 
  ('Vitosha', 'https://memento4.barsy.bg', 'Menelaos', 'Menelaos123#', true),
  ('NDK', 'https://memento3.barsy.bg', 'Menelaos', 'Menelaos123#', true)
ON CONFLICT DO NOTHING;
