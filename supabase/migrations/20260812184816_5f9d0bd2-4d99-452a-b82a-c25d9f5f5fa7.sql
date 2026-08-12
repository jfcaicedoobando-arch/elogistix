-- Cobertura RLS: demo_seed_state tenía RLS habilitado pero CERO policies, lo
-- que el verificador de CI marca como hueco (una tabla sin policies pasa
-- trivialmente cualquier test de aislamiento). La tabla es interna y sólo la
-- toca la edge function `demo-access` vía service_role (que hace bypass de
-- RLS), así que la policy correcta es un deny-all explícito y documentado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
     WHERE p.polrelid = 'public.demo_seed_state'::regclass
       AND p.polname = 'demo_seed_state_deny_all'
  ) THEN
    CREATE POLICY demo_seed_state_deny_all
      ON public.demo_seed_state
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

REVOKE ALL ON public.demo_seed_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.demo_seed_state TO service_role;

COMMENT ON TABLE public.demo_seed_state IS
  'Estado interno de la siembra de datos demo (EF-09). Sin acceso vía Data API: deny-all para anon/authenticated; sólo service_role desde la edge function demo-access.';
