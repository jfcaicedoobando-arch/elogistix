ALTER TABLE public.navieras
  ADD CONSTRAINT navieras_code_scac_format CHECK (code ~ '^[A-Z]{4}$') NOT VALID;