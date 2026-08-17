-- 1) Presupuesto mensual de la organización
CREATE TABLE IF NOT EXISTS public.crm_presupuesto_mensual (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  monto numeric(14,2) NOT NULL DEFAULT 0,
  moneda public.moneda NOT NULL DEFAULT 'MXN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, anio, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_presupuesto_mensual TO authenticated;
GRANT ALL ON public.crm_presupuesto_mensual TO service_role;
ALTER TABLE public.crm_presupuesto_mensual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura presupuesto de la org" ON public.crm_presupuesto_mensual;
CREATE POLICY "Lectura presupuesto de la org"
  ON public.crm_presupuesto_mensual FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id())
         OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "Gerencia administra presupuesto" ON public.crm_presupuesto_mensual;
CREATE POLICY "Gerencia administra presupuesto"
  ON public.crm_presupuesto_mensual FOR ALL TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
     OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_comercial'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
     OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_comercial'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "Scope tenant activo super admin" ON public.crm_presupuesto_mensual;
CREATE POLICY "Scope tenant activo super admin"
  ON public.crm_presupuesto_mensual AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id));

CREATE TRIGGER update_crm_presupuesto_mensual_updated_at
  BEFORE UPDATE ON public.crm_presupuesto_mensual
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Metas de actividad
CREATE TABLE IF NOT EXISTS public.crm_metas_actividad (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  periodo text NOT NULL CHECK (periodo IN ('semanal', 'dia_30', 'dia_60', 'dia_90', 'trimestre')),
  icp_validados integer NOT NULL DEFAULT 0,
  contactadas integer NOT NULL DEFAULT 0,
  reuniones integer NOT NULL DEFAULT 0,
  cotizaciones integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, periodo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_metas_actividad TO authenticated;
GRANT ALL ON public.crm_metas_actividad TO service_role;
ALTER TABLE public.crm_metas_actividad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura metas de la org" ON public.crm_metas_actividad;
CREATE POLICY "Lectura metas de la org"
  ON public.crm_metas_actividad FOR SELECT TO authenticated
  USING (organization_id = (SELECT public.current_user_org_id())
         OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "Gerencia administra metas" ON public.crm_metas_actividad;
CREATE POLICY "Gerencia administra metas"
  ON public.crm_metas_actividad FOR ALL TO authenticated
  USING (
    (organization_id = (SELECT public.current_user_org_id())
     OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_comercial'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  )
  WITH CHECK (
    (organization_id = (SELECT public.current_user_org_id())
     OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
    AND (
      (SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_comercial'::public.app_role))
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "Scope tenant activo super admin" ON public.crm_metas_actividad;
CREATE POLICY "Scope tenant activo super admin"
  ON public.crm_metas_actividad AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id));

CREATE TRIGGER update_crm_metas_actividad_updated_at
  BEFORE UPDATE ON public.crm_metas_actividad
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Banderas de calidad en actividades
ALTER TABLE public.crm_actividades
  ADD COLUMN IF NOT EXISTS contacto_efectivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reunion_calificada boolean NOT NULL DEFAULT false;

-- 4) Embudo con conversión etapa a etapa
CREATE OR REPLACE FUNCTION public.crm_embudo_conversion(p_desde date, p_hasta date)
RETURNS TABLE (
  etapa_id uuid,
  etapa_nombre text,
  orden integer,
  probabilidad_default numeric,
  oportunidades integer,
  valor numeric,
  ponderado numeric,
  entradas integer,
  conversion_desde_anterior numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH etapas AS (
    SELECT e.id, e.nombre, e.orden, e.probabilidad_default
      FROM public.crm_etapas_pipeline e
     WHERE e.deleted_at IS NULL AND e.activa
  ),
  actuales AS (
    SELECT o.etapa_id,
           COUNT(*)::int AS oportunidades,
           COALESCE(SUM(o.monto_estimado), 0) AS valor,
           COALESCE(SUM(o.monto_estimado * COALESCE(o.probabilidad, 0) / 100.0), 0) AS ponderado
      FROM public.crm_oportunidades o
     WHERE o.deleted_at IS NULL
       AND o.created_at::date BETWEEN p_desde AND p_hasta
     GROUP BY o.etapa_id
  ),
  entradas AS (
    SELECT h.etapa_destino_id AS etapa_id, COUNT(DISTINCT h.oportunidad_id)::int AS entradas
      FROM public.crm_historial_etapas h
     WHERE h.created_at::date BETWEEN p_desde AND p_hasta
     GROUP BY h.etapa_destino_id
  ),
  agregado AS (
    SELECT e.id, e.nombre, e.orden, e.probabilidad_default,
           COALESCE(a.oportunidades, 0) AS oportunidades,
           COALESCE(a.valor, 0) AS valor,
           COALESCE(a.ponderado, 0) AS ponderado,
           GREATEST(COALESCE(en.entradas, 0), COALESCE(a.oportunidades, 0)) AS entradas
      FROM etapas e
      LEFT JOIN actuales a ON a.etapa_id = e.id
      LEFT JOIN entradas en ON en.etapa_id = e.id
  )
  SELECT g.id, g.nombre, g.orden, g.probabilidad_default, g.oportunidades, g.valor, g.ponderado, g.entradas,
         CASE
           WHEN LAG(g.entradas) OVER (ORDER BY g.orden) IS NULL
             OR LAG(g.entradas) OVER (ORDER BY g.orden) = 0 THEN NULL
           ELSE ROUND(g.entradas::numeric / LAG(g.entradas) OVER (ORDER BY g.orden), 4)
         END AS conversion_desde_anterior
    FROM agregado g
   ORDER BY g.orden;
$$;

REVOKE ALL ON FUNCTION public.crm_embudo_conversion(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_embudo_conversion(date, date) TO authenticated, service_role;

-- 5) Avance de actividad por vendedor
CREATE OR REPLACE FUNCTION public.crm_avance_actividad(p_desde date, p_hasta date)
RETURNS TABLE (
  vendedor_email text,
  contactos integer,
  contactos_efectivos integer,
  reuniones_calificadas integer,
  cotizaciones integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH act AS (
    SELECT COALESCE(a.responsable_email, 'sin asignar') AS vendedor_email,
           COUNT(*)::int AS contactos,
           COUNT(*) FILTER (WHERE a.contacto_efectivo)::int AS contactos_efectivos,
           COUNT(*) FILTER (WHERE a.reunion_calificada)::int AS reuniones_calificadas
      FROM public.crm_actividades a
     WHERE a.deleted_at IS NULL
       AND COALESCE(a.fecha_completada, a.fecha_programada, a.created_at)::date BETWEEN p_desde AND p_hasta
     GROUP BY 1
  ),
  cots AS (
    SELECT COALESCE(o.vendedor_email, 'sin asignar') AS vendedor_email, COUNT(*)::int AS cotizaciones
      FROM public.crm_oportunidades o
     WHERE o.deleted_at IS NULL
       AND o.created_at::date BETWEEN p_desde AND p_hasta
     GROUP BY 1
  )
  SELECT COALESCE(a.vendedor_email, c.vendedor_email) AS vendedor_email,
         COALESCE(a.contactos, 0), COALESCE(a.contactos_efectivos, 0),
         COALESCE(a.reuniones_calificadas, 0), COALESCE(c.cotizaciones, 0)
    FROM act a
    FULL OUTER JOIN cots c ON c.vendedor_email = a.vendedor_email
   ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.crm_avance_actividad(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_avance_actividad(date, date) TO authenticated, service_role;