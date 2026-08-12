-- EF-09 (auditoría edge functions): marcador de última re-siembra demo.
-- demo-access (service_role) la lee/escribe para no re-ejecutar la RPC
-- destructiva seed_demo_organization en cada llamada.

CREATE TABLE IF NOT EXISTS public.demo_seed_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_seeded_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.demo_seed_state (id, last_seeded_at)
VALUES (true, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.demo_seed_state ENABLE ROW LEVEL SECURITY;
-- Sin policies: sólo service_role (la edge demo-access) accede; RLS bloquea
-- a anon/authenticated por defecto.
REVOKE ALL ON public.demo_seed_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.demo_seed_state TO service_role;

COMMENT ON TABLE public.demo_seed_state IS
  'Un renglón: cuándo se re-sembró la org demo por última vez (EF-09).';