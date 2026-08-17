-- 1) Campos de trazabilidad en oportunidades
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS ultimo_movimiento_at timestamptz,
  ADD COLUMN IF NOT EXISTS etapa_desde_at timestamptz;

UPDATE public.crm_oportunidades
   SET ultimo_movimiento_at = COALESCE(ultimo_movimiento_at, updated_at, created_at, now()),
       etapa_desde_at = COALESCE(etapa_desde_at, updated_at, created_at, now())
 WHERE ultimo_movimiento_at IS NULL OR etapa_desde_at IS NULL;

ALTER TABLE public.crm_oportunidades
  ALTER COLUMN ultimo_movimiento_at SET DEFAULT now(),
  ALTER COLUMN etapa_desde_at SET DEFAULT now();

-- 2) Historial de etapas
CREATE TABLE IF NOT EXISTS public.crm_historial_etapas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  oportunidad_id uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  etapa_origen_id uuid REFERENCES public.crm_etapas_pipeline(id),
  etapa_destino_id uuid NOT NULL REFERENCES public.crm_etapas_pipeline(id),
  dias_en_etapa numeric(10,2),
  usuario_id uuid,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_historial_etapas_op ON public.crm_historial_etapas(oportunidad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_historial_etapas_org ON public.crm_historial_etapas(organization_id, created_at DESC);

GRANT SELECT ON public.crm_historial_etapas TO authenticated;
GRANT ALL ON public.crm_historial_etapas TO service_role;

ALTER TABLE public.crm_historial_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura historial etapas de la org" ON public.crm_historial_etapas;
CREATE POLICY "Lectura historial etapas de la org"
  ON public.crm_historial_etapas FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "Scope tenant activo super admin" ON public.crm_historial_etapas;
CREATE POLICY "Scope tenant activo super admin"
  ON public.crm_historial_etapas AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id));

-- 3) Trigger: registrar cambio de etapa y refrescar contadores
CREATE OR REPLACE FUNCTION public._crm_registrar_cambio_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.ultimo_movimiento_at := now();

  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    INSERT INTO public.crm_historial_etapas (
      organization_id, oportunidad_id, etapa_origen_id, etapa_destino_id,
      dias_en_etapa, usuario_id, usuario_email
    ) VALUES (
      NEW.organization_id, NEW.id, OLD.etapa_id, NEW.etapa_id,
      ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(OLD.etapa_desde_at, OLD.created_at, now()))) / 86400.0, 2),
      auth.uid(),
      NULLIF(current_setting('request.jwt.claims', true), '')::json ->> 'email'
    );
    NEW.etapa_desde_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_registrar_cambio_etapa ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_registrar_cambio_etapa
  BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public._crm_registrar_cambio_etapa();

-- 4) Trigger: una actividad ligada a la oportunidad cuenta como movimiento
CREATE OR REPLACE FUNCTION public._crm_actividad_toca_oportunidad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entidad_tipo = 'oportunidad'::public.crm_entidad_tipo AND NEW.entidad_id IS NOT NULL THEN
    UPDATE public.crm_oportunidades
       SET ultimo_movimiento_at = now()
     WHERE id = NEW.entidad_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_actividad_toca_oportunidad ON public.crm_actividades;
CREATE TRIGGER trg_crm_actividad_toca_oportunidad
  AFTER INSERT ON public.crm_actividades
  FOR EACH ROW EXECUTE FUNCTION public._crm_actividad_toca_oportunidad();

-- 5) Listado accionable de higiene (respeta RLS del usuario: SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.crm_higiene_oportunidades()
RETURNS TABLE (
  id uuid,
  nombre text,
  cliente_nombre text,
  etapa_id uuid,
  etapa_nombre text,
  vendedor_email text,
  monto_estimado numeric,
  moneda text,
  probabilidad numeric,
  fecha_estimada_cierre date,
  ultimo_movimiento_at timestamptz,
  dias_sin_movimiento integer,
  sla_dias integer,
  estado_higiene text,
  registro_completo boolean,
  proxima_actividad_at timestamptz,
  actividad_vencida boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT o.id, o.nombre, o.cliente_nombre, o.etapa_id, e.nombre AS etapa_nombre,
           o.vendedor_email, o.monto_estimado, o.moneda::text AS moneda, o.probabilidad,
           o.fecha_estimada_cierre,
           COALESCE(o.ultimo_movimiento_at, o.updated_at, o.created_at) AS ultimo_movimiento_at,
           COALESCE(NULLIF(e.dias_seguimiento, 0), 7) AS sla_dias,
           (SELECT MIN(a.fecha_programada)
              FROM public.crm_actividades a
             WHERE a.entidad_tipo = 'oportunidad'::public.crm_entidad_tipo
               AND a.entidad_id = o.id
               AND a.deleted_at IS NULL
               AND a.fecha_completada IS NULL) AS proxima_actividad_at
      FROM public.crm_oportunidades o
      JOIN public.crm_etapas_pipeline e ON e.id = o.etapa_id
     WHERE o.deleted_at IS NULL
       AND e.tipo = 'abierta'::public.crm_etapa_tipo
  )
  SELECT b.id, b.nombre, b.cliente_nombre, b.etapa_id, b.etapa_nombre, b.vendedor_email,
         b.monto_estimado, b.moneda, b.probabilidad, b.fecha_estimada_cierre,
         b.ultimo_movimiento_at,
         GREATEST(0, (EXTRACT(EPOCH FROM (now() - b.ultimo_movimiento_at)) / 86400)::int) AS dias_sin_movimiento,
         b.sla_dias,
         CASE
           WHEN (EXTRACT(EPOCH FROM (now() - b.ultimo_movimiento_at)) / 86400) > b.sla_dias THEN 'vencida'
           WHEN (EXTRACT(EPOCH FROM (now() - b.ultimo_movimiento_at)) / 86400) >= (b.sla_dias * 0.7) THEN 'por_vencer'
           ELSE 'en_tiempo'
         END AS estado_higiene,
         (COALESCE(b.monto_estimado, 0) > 0
          AND b.fecha_estimada_cierre IS NOT NULL
          AND COALESCE(b.vendedor_email, '') <> ''
          AND b.proxima_actividad_at IS NOT NULL) AS registro_completo,
         b.proxima_actividad_at,
         (b.proxima_actividad_at IS NOT NULL AND b.proxima_actividad_at < now()) AS actividad_vencida
    FROM base b;
$$;

REVOKE ALL ON FUNCTION public.crm_higiene_oportunidades() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_higiene_oportunidades() TO authenticated, service_role;

-- 6) Resumen de higiene
CREATE OR REPLACE FUNCTION public.crm_higiene_pipeline()
RETURNS TABLE (
  abiertas integer,
  registros_completos integer,
  higiene_pct numeric,
  seguimiento_oportuno_pct numeric,
  vencidas integer,
  sin_actividad_programada integer,
  pipeline_bruto numeric,
  pipeline_ponderado numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH h AS (SELECT * FROM public.crm_higiene_oportunidades())
  SELECT COUNT(*)::int,
         COUNT(*) FILTER (WHERE registro_completo)::int,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(COUNT(*) FILTER (WHERE registro_completo)::numeric / COUNT(*), 4) END,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(COUNT(*) FILTER (WHERE NOT actividad_vencida)::numeric / COUNT(*), 4) END,
         COUNT(*) FILTER (WHERE estado_higiene = 'vencida')::int,
         COUNT(*) FILTER (WHERE proxima_actividad_at IS NULL)::int,
         COALESCE(SUM(monto_estimado), 0),
         COALESCE(SUM(monto_estimado * COALESCE(probabilidad, 0) / 100.0), 0)
    FROM h;
$$;

REVOKE ALL ON FUNCTION public.crm_higiene_pipeline() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_higiene_pipeline() TO authenticated, service_role;
-- v13.629.1 (CI H6): endurecimiento de permisos de las funciones trigger
-- SECURITY DEFINER creadas arriba (ya revocadas a anon en migración posterior).
REVOKE ALL ON FUNCTION public._crm_registrar_cambio_etapa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_registrar_cambio_etapa() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._crm_actividad_toca_oportunidad() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_actividad_toca_oportunidad() TO authenticated, service_role;
