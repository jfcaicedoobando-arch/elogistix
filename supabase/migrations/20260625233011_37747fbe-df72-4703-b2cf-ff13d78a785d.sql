
CREATE TABLE public.facturapi_credenciales (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  facturapi_org_id text,
  ambiente text NOT NULL DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox','live')),
  api_key_sandbox_secret_name text,
  api_key_live_secret_name text,
  certificado_cargado boolean NOT NULL DEFAULT false,
  certificado_vence_at date,
  webhook_secret text,
  last_test_timbre_at timestamptz,
  datos_fiscales_completos boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facturapi_credenciales TO authenticated;
GRANT ALL ON public.facturapi_credenciales TO service_role;

ALTER TABLE public.facturapi_credenciales ENABLE ROW LEVEL SECURITY;

-- Lectura: admins de la org y super_admin
CREATE POLICY "admin_org puede leer credenciales facturapi de su org"
  ON public.facturapi_credenciales
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Escritura: admins de la org y super_admin
CREATE POLICY "admin_org puede gestionar credenciales facturapi de su org"
  ON public.facturapi_credenciales
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE TRIGGER trg_facturapi_credenciales_updated_at
  BEFORE UPDATE ON public.facturapi_credenciales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.facturapi_credenciales IS
  'Credenciales y estado de la integración FacturApi por organización. Las API keys reales viven como secrets de Supabase (FACTURAPI_KEY_<ORG>_<AMBIENTE>); aquí sólo guardamos el nombre del secret.';
