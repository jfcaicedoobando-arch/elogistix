-- 1) Criterios de salida configurables por etapa
CREATE TABLE public.crm_etapa_criterios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  etapa_id uuid NOT NULL REFERENCES public.crm_etapas_pipeline(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  obligatorio boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_etapa_criterios TO authenticated;
GRANT ALL ON public.crm_etapa_criterios TO service_role;
ALTER TABLE public.crm_etapa_criterios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read crm_etapa_criterios" ON public.crm_etapa_criterios;
CREATE POLICY "Tenant read crm_etapa_criterios" ON public.crm_etapa_criterios
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT current_user_org_id()))
    OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role))
  );

DROP POLICY IF EXISTS "Staff CRUD crm_etapa_criterios" ON public.crm_etapa_criterios;
CREATE POLICY "Staff CRUD crm_etapa_criterios" ON public.crm_etapa_criterios
  FOR ALL TO authenticated
  USING (
    ((organization_id = (SELECT current_user_org_id()))
      OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT puede_escribir_cotizaciones((SELECT auth.uid())))
  )
  WITH CHECK (
    ((organization_id = (SELECT current_user_org_id()))
      OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT puede_escribir_cotizaciones((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "Scope tenant activo super admin" ON public.crm_etapa_criterios;
CREATE POLICY "Scope tenant activo super admin" ON public.crm_etapa_criterios
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (rls_tenant_scope_ok(organization_id))
  WITH CHECK (rls_tenant_scope_ok(organization_id));

CREATE INDEX IF NOT EXISTS idx_crm_etapa_criterios_etapa ON public.crm_etapa_criterios(etapa_id, orden) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_crm_etapa_criterios_updated_at
  BEFORE UPDATE ON public.crm_etapa_criterios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Cumplimiento por oportunidad
CREATE TABLE public.crm_oportunidad_criterios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  oportunidad_id uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  criterio_id uuid NOT NULL REFERENCES public.crm_etapa_criterios(id) ON DELETE CASCADE,
  cumplido_at timestamptz NOT NULL DEFAULT now(),
  cumplido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (oportunidad_id, criterio_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_oportunidad_criterios TO authenticated;
GRANT ALL ON public.crm_oportunidad_criterios TO service_role;
ALTER TABLE public.crm_oportunidad_criterios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant read crm_oportunidad_criterios" ON public.crm_oportunidad_criterios;
CREATE POLICY "Tenant read crm_oportunidad_criterios" ON public.crm_oportunidad_criterios
  FOR SELECT TO authenticated
  USING (
    (organization_id = (SELECT current_user_org_id()))
    OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role))
  );

DROP POLICY IF EXISTS "Staff CRUD crm_oportunidad_criterios" ON public.crm_oportunidad_criterios;
CREATE POLICY "Staff CRUD crm_oportunidad_criterios" ON public.crm_oportunidad_criterios
  FOR ALL TO authenticated
  USING (
    ((organization_id = (SELECT current_user_org_id()))
      OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT puede_escribir_cotizaciones((SELECT auth.uid())))
  )
  WITH CHECK (
    ((organization_id = (SELECT current_user_org_id()))
      OR (SELECT has_role((SELECT auth.uid()), 'super_admin'::app_role)))
    AND (SELECT puede_escribir_cotizaciones((SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "Scope tenant activo super admin" ON public.crm_oportunidad_criterios;
CREATE POLICY "Scope tenant activo super admin" ON public.crm_oportunidad_criterios
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (rls_tenant_scope_ok(organization_id))
  WITH CHECK (rls_tenant_scope_ok(organization_id));

CREATE INDEX IF NOT EXISTS idx_crm_oportunidad_criterios_op ON public.crm_oportunidad_criterios(oportunidad_id);

CREATE TRIGGER trg_crm_oportunidad_criterios_updated_at
  BEFORE UPDATE ON public.crm_oportunidad_criterios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Metas por oportunidad
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS monto_meta numeric,
  ADD COLUMN IF NOT EXISTS fecha_meta_cierre date,
  ADD COLUMN IF NOT EXISTS compromiso_nota text;

-- 4) Avance de criterios en lote
CREATE OR REPLACE FUNCTION public.crm_criterios_avance(p_oportunidad_ids uuid[])
RETURNS TABLE (
  oportunidad_id uuid,
  etapa_id uuid,
  total integer,
  cumplidos integer,
  obligatorios_pendientes integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    o.id AS oportunidad_id,
    o.etapa_id,
    COUNT(c.id)::int AS total,
    COUNT(oc.id)::int AS cumplidos,
    COUNT(*) FILTER (WHERE c.obligatorio AND oc.id IS NULL)::int AS obligatorios_pendientes
  FROM public.crm_oportunidades o
  LEFT JOIN public.crm_etapa_criterios c
    ON c.etapa_id = o.etapa_id AND c.activo AND c.deleted_at IS NULL
  LEFT JOIN public.crm_oportunidad_criterios oc
    ON oc.oportunidad_id = o.id AND oc.criterio_id = c.id
  WHERE o.id = ANY(p_oportunidad_ids)
    AND o.deleted_at IS NULL
  GROUP BY o.id, o.etapa_id
$$;

REVOKE ALL ON FUNCTION public.crm_criterios_avance(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_criterios_avance(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_criterios_avance(uuid[]) TO authenticated, service_role;