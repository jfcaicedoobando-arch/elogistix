CREATE TABLE public.crm_brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
  email text NOT NULL CHECK (position('@' in email) > 1),
  comision_pct numeric(5,2) NOT NULL CHECK (comision_pct >= 0 AND comision_pct <= 100),
  activo boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_brokers_org_email_uq ON public.crm_brokers (organization_id, lower(email));
CREATE INDEX crm_brokers_user_idx ON public.crm_brokers (user_id);

GRANT SELECT ON public.crm_brokers TO authenticated;
GRANT ALL ON public.crm_brokers TO service_role;
ALTER TABLE public.crm_brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_brokers_select ON public.crm_brokers FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.has_any_role_in_org((SELECT auth.uid()), ARRAY['admin_org','gerente_comercial']::public.app_role[], organization_id)
);

ALTER TABLE public.crm_empresas ADD COLUMN broker_id uuid REFERENCES public.crm_brokers(id) ON DELETE RESTRICT;
CREATE INDEX crm_empresas_broker_idx ON public.crm_empresas (broker_id) WHERE broker_id IS NOT NULL;

-- Portal: el broker sólo ve nombre, estado y etapa de las empresas que trae.
CREATE FUNCTION public.broker_mis_empresas()
RETURNS TABLE (empresa_id uuid, empresa text, estado_crm text, organizacion text,
               oportunidad text, etapa text, etapa_tipo text, actualizado timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.id, e.nombre, e.estado_crm, o.nombre,
         op.nombre, ep.nombre, ep.tipo::text, COALESCE(op.updated_at, e.updated_at)
    FROM public.crm_brokers b
    JOIN public.crm_empresas e ON e.broker_id = b.id AND e.deleted_at IS NULL
    JOIN public.organizations o ON o.id = e.organization_id
    LEFT JOIN public.crm_oportunidad_empresa oe ON oe.empresa_id = e.id
    LEFT JOIN public.crm_oportunidades op ON op.id = oe.oportunidad_id AND op.deleted_at IS NULL
    LEFT JOIN public.crm_etapas_pipeline ep ON ep.id = op.etapa_id
   WHERE b.user_id = auth.uid() AND b.activo
   ORDER BY e.nombre
   LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.broker_mis_empresas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_mis_empresas() TO authenticated;