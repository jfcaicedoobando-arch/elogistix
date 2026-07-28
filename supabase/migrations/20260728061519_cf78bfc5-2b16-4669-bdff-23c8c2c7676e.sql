INSERT INTO public.tipos_contenedor (code, name) VALUES
  ('20GP', '20'' GP'),
  ('20DV', '20'' Dry'),
  ('20HC', '20'' High Cube'),
  ('20RF', '20'' Reefer'),
  ('20OT', '20'' Open Top'),
  ('20FR', '20'' Flat Rack'),
  ('40DV', '40'' Dry'),
  ('40HC', '40'' High Cube'),
  ('40RF', '40'' Reefer'),
  ('40OT', '40'' Open Top'),
  ('40FR', '40'' Flat Rack'),
  ('45HC', '45'' High Cube')
ON CONFLICT (code) DO NOTHING;