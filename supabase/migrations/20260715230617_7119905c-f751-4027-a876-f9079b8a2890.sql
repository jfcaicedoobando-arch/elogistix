DROP POLICY IF EXISTS "Anyone can insert demo leads" ON public.demo_leads;

CREATE POLICY "Anyone can insert demo leads"
ON public.demo_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  nombre IS NOT NULL AND length(btrim(nombre)) BETWEEN 2 AND 120
  AND empresa IS NOT NULL AND length(btrim(empresa)) BETWEEN 2 AND 160
  AND email IS NOT NULL AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' AND length(email) <= 200
  AND telefono_e164 IS NOT NULL AND telefono_e164 ~ '^\+[1-9][0-9]{6,14}$'
  AND (user_agent IS NULL OR length(user_agent) <= 500)
);