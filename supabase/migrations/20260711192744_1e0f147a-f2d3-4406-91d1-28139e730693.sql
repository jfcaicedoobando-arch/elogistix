
CREATE TABLE public.demo_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  empresa TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono_e164 TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  referrer TEXT,
  landing_path TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.demo_leads TO anon;
GRANT INSERT ON public.demo_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_leads TO authenticated;
GRANT ALL ON public.demo_leads TO service_role;

ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante puede registrar su interés en la demo
CREATE POLICY "Anyone can insert demo leads"
  ON public.demo_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Sólo super_admin puede leer los leads
CREATE POLICY "Super admins can view demo leads"
  ON public.demo_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete demo leads"
  ON public.demo_leads FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_demo_leads_created_at ON public.demo_leads (created_at DESC);
CREATE INDEX idx_demo_leads_email ON public.demo_leads (email);
