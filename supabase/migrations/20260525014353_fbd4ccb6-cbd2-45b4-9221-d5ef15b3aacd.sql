
-- ============================================================================
-- 1) Enums CRM
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.crm_lead_estado AS ENUM ('Nuevo', 'Contactado', 'Calificado', 'Descalificado', 'Convertido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_lead_fuente AS ENUM ('Web', 'Referido', 'Campaña', 'Llamada en frío', 'Evento', 'Otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_etapa_tipo AS ENUM ('abierta', 'ganada', 'perdida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_actividad_tipo AS ENUM ('llamada', 'email', 'reunion', 'tarea', 'nota');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_entidad_tipo AS ENUM ('lead', 'oportunidad', 'cliente', 'contacto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2) crm_etapas_pipeline
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_etapas_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  probabilidad_default integer NOT NULL DEFAULT 0 CHECK (probabilidad_default BETWEEN 0 AND 100),
  color text NOT NULL DEFAULT '#3b82f6',
  tipo public.crm_etapa_tipo NOT NULL DEFAULT 'abierta',
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  UNIQUE (organization_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_crm_etapas_org ON public.crm_etapas_pipeline(organization_id, orden);
ALTER TABLE public.crm_etapas_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted crm_etapas_pipeline" ON public.crm_etapas_pipeline
  AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY "Tenant read crm_etapas_pipeline" ON public.crm_etapas_pipeline
  FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Tenant admin crm_etapas_pipeline" ON public.crm_etapas_pipeline
  FOR ALL TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

-- ============================================================================
-- 3) crm_motivos_perdida
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_motivos_perdida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  nombre text NOT NULL,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  UNIQUE (organization_id, nombre)
);
ALTER TABLE public.crm_motivos_perdida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted crm_motivos_perdida" ON public.crm_motivos_perdida
  AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY "Tenant read crm_motivos_perdida" ON public.crm_motivos_perdida
  FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Tenant admin crm_motivos_perdida" ON public.crm_motivos_perdida
  FOR ALL TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

-- ============================================================================
-- 4) crm_leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  empresa text NOT NULL,
  contacto text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  pais text NOT NULL DEFAULT '',
  ciudad text NOT NULL DEFAULT '',
  fuente public.crm_lead_fuente NOT NULL DEFAULT 'Otro',
  interes_modo text NOT NULL DEFAULT '',
  score integer NOT NULL DEFAULT 3 CHECK (score BETWEEN 1 AND 5),
  estado public.crm_lead_estado NOT NULL DEFAULT 'Nuevo',
  vendedor_id uuid,
  vendedor_email text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  cliente_convertido_id uuid,
  oportunidad_convertida_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org ON public.crm_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_vendedor ON public.crm_leads(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_estado ON public.crm_leads(estado);
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted crm_leads" ON public.crm_leads
  AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY "Staff CRUD crm_leads" ON public.crm_leads
  FOR ALL TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY "Vendedor own crm_leads" ON public.crm_leads
  FOR ALL TO authenticated
  USING (organization_id = current_user_org_id() AND has_role(auth.uid(), 'vendedor'::app_role) AND vendedor_id = auth.uid())
  WITH CHECK (organization_id = current_user_org_id() AND has_role(auth.uid(), 'vendedor'::app_role) AND vendedor_id = auth.uid());
CREATE POLICY "Tenant viewer crm_leads" ON public.crm_leads
  FOR SELECT TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role));

-- ============================================================================
-- 5) crm_oportunidades
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  nombre text NOT NULL,
  cliente_id uuid,
  cliente_nombre text NOT NULL DEFAULT '',
  lead_id uuid,
  vendedor_id uuid,
  vendedor_email text NOT NULL DEFAULT '',
  etapa_id uuid NOT NULL,
  monto_estimado numeric NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'MXN',
  probabilidad integer NOT NULL DEFAULT 0 CHECK (probabilidad BETWEEN 0 AND 100),
  fecha_estimada_cierre date,
  fecha_cierre_real date,
  motivo_perdida_id uuid,
  modo text NOT NULL DEFAULT '',
  tipo_carga text NOT NULL DEFAULT '',
  origen text NOT NULL DEFAULT '',
  destino text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX IF NOT EXISTS idx_crm_op_org ON public.crm_oportunidades(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_op_vendedor ON public.crm_oportunidades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_crm_op_etapa ON public.crm_oportunidades(etapa_id);
CREATE INDEX IF NOT EXISTS idx_crm_op_cliente ON public.crm_oportunidades(cliente_id);
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted crm_oportunidades" ON public.crm_oportunidades
  AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY "Staff CRUD crm_oportunidades" ON public.crm_oportunidades
  FOR ALL TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY "Vendedor own crm_oportunidades" ON public.crm_oportunidades
  FOR ALL TO authenticated
  USING (organization_id = current_user_org_id() AND has_role(auth.uid(), 'vendedor'::app_role) AND vendedor_id = auth.uid())
  WITH CHECK (organization_id = current_user_org_id() AND has_role(auth.uid(), 'vendedor'::app_role) AND vendedor_id = auth.uid());
CREATE POLICY "Tenant viewer crm_oportunidades" ON public.crm_oportunidades
  FOR SELECT TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role));

-- ============================================================================
-- 6) crm_actividades (polimórfica)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  tipo public.crm_actividad_tipo NOT NULL,
  asunto text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  entidad_tipo public.crm_entidad_tipo NOT NULL,
  entidad_id uuid NOT NULL,
  fecha_programada timestamptz,
  fecha_completada timestamptz,
  duracion_min integer,
  resultado text NOT NULL DEFAULT '',
  responsable_id uuid,
  responsable_email text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX IF NOT EXISTS idx_crm_act_org ON public.crm_actividades(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_entidad ON public.crm_actividades(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_responsable ON public.crm_actividades(responsable_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_pendientes ON public.crm_actividades(fecha_programada) WHERE fecha_completada IS NULL;
ALTER TABLE public.crm_actividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted crm_actividades" ON public.crm_actividades
  AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY "Staff CRUD crm_actividades" ON public.crm_actividades
  FOR ALL TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));
CREATE POLICY "Vendedor own crm_actividades" ON public.crm_actividades
  FOR ALL TO authenticated
  USING (organization_id = current_user_org_id() AND has_role(auth.uid(), 'vendedor'::app_role) AND responsable_id = auth.uid())
  WITH CHECK (organization_id = current_user_org_id() AND has_role(auth.uid(), 'vendedor'::app_role) AND responsable_id = auth.uid());
CREATE POLICY "Tenant viewer crm_actividades" ON public.crm_actividades
  FOR SELECT TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role));

-- ============================================================================
-- 7) crm_cuotas_vendedor
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.crm_cuotas_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  vendedor_id uuid NOT NULL,
  vendedor_email text NOT NULL DEFAULT '',
  anio integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  cuota_monto numeric NOT NULL DEFAULT 0,
  moneda text NOT NULL DEFAULT 'MXN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vendedor_id, anio, mes)
);
ALTER TABLE public.crm_cuotas_vendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read crm_cuotas_vendedor" ON public.crm_cuotas_vendedor
  FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Tenant admin crm_cuotas_vendedor" ON public.crm_cuotas_vendedor
  FOR ALL TO authenticated
  USING (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)))
  WITH CHECK (((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)));

-- ============================================================================
-- 8) cotizaciones.oportunidad_id
-- ============================================================================
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS oportunidad_id uuid;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_oportunidad ON public.cotizaciones(oportunidad_id);

-- ============================================================================
-- 9) Triggers updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS trg_crm_etapas_updated_at ON public.crm_etapas_pipeline;
CREATE TRIGGER trg_crm_etapas_updated_at BEFORE UPDATE ON public.crm_etapas_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_crm_op_updated_at ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_op_updated_at BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_crm_act_updated_at ON public.crm_actividades;
CREATE TRIGGER trg_crm_act_updated_at BEFORE UPDATE ON public.crm_actividades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_crm_cuotas_updated_at ON public.crm_cuotas_vendedor;
CREATE TRIGGER trg_crm_cuotas_updated_at BEFORE UPDATE ON public.crm_cuotas_vendedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 10) Trigger: cotización aceptada → oportunidad ganada
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crm_marcar_oportunidad_ganada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etapa_ganada uuid;
BEGIN
  IF NEW.oportunidad_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.estado::text <> 'Aceptada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado = NEW.estado THEN RETURN NEW; END IF;

  SELECT id INTO v_etapa_ganada
  FROM public.crm_etapas_pipeline
  WHERE organization_id = NEW.organization_id
    AND tipo = 'ganada'
    AND deleted_at IS NULL
  ORDER BY orden ASC LIMIT 1;

  IF v_etapa_ganada IS NULL THEN RETURN NEW; END IF;

  UPDATE public.crm_oportunidades
  SET etapa_id = v_etapa_ganada, probabilidad = 100,
      fecha_cierre_real = COALESCE(fecha_cierre_real, CURRENT_DATE)
  WHERE id = NEW.oportunidad_id AND organization_id = NEW.organization_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizacion_acepta_oportunidad ON public.cotizaciones;
CREATE TRIGGER trg_cotizacion_acepta_oportunidad
  AFTER INSERT OR UPDATE OF estado ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.crm_marcar_oportunidad_ganada();

-- ============================================================================
-- 11) Seed: etapas y motivos default por organización existente
-- ============================================================================
INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, orden, probabilidad_default, color, tipo)
SELECT o.id, x.nombre, x.orden, x.prob, x.color, x.tipo::public.crm_etapa_tipo
FROM public.organizations o
CROSS JOIN (VALUES
  ('Prospección',   1, 10, '#94a3b8', 'abierta'),
  ('Cotizando',     2, 30, '#3b82f6', 'abierta'),
  ('Negociación',   3, 60, '#f59e0b', 'abierta'),
  ('Ganada',        4, 100,'#10b981', 'ganada'),
  ('Perdida',       5, 0,  '#ef4444', 'perdida')
) AS x(nombre, orden, prob, color, tipo)
ON CONFLICT (organization_id, nombre) DO NOTHING;

INSERT INTO public.crm_motivos_perdida (organization_id, nombre)
SELECT o.id, m.nombre
FROM public.organizations o
CROSS JOIN (VALUES
  ('Precio'), ('Tiempo de tránsito'), ('Competencia'),
  ('Sin presupuesto'), ('No respondió'), ('Otro')
) AS m(nombre)
ON CONFLICT (organization_id, nombre) DO NOTHING;
