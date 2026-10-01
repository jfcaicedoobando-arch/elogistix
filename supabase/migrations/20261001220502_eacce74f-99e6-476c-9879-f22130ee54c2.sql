-- CRM por objetos · Fase 1: Empresas, Contactos, vínculos y propiedades configurables.
-- Aditiva: no borra ni renombra nada de crm_leads / crm_oportunidades / crm_actividades.

-- 1) Objetos
CREATE TABLE public.crm_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  nombre text NOT NULL,
  lead_origen_id uuid UNIQUE,
  cliente_id uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE public.crm_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  nombre text NOT NULL,
  email text,
  telefono text,
  lead_origen_id uuid UNIQUE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 2) Vínculos (muchos a muchos)
CREATE TABLE public.crm_empresa_contacto (
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  empresa_id uuid NOT NULL REFERENCES public.crm_empresas(id) ON DELETE CASCADE,
  contacto_id uuid NOT NULL REFERENCES public.crm_contactos(id) ON DELETE CASCADE,
  PRIMARY KEY (empresa_id, contacto_id)
);
CREATE TABLE public.crm_oportunidad_empresa (
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  oportunidad_id uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.crm_empresas(id) ON DELETE CASCADE,
  PRIMARY KEY (oportunidad_id, empresa_id)
);
CREATE TABLE public.crm_oportunidad_contacto (
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  oportunidad_id uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  contacto_id uuid NOT NULL REFERENCES public.crm_contactos(id) ON DELETE CASCADE,
  PRIMARY KEY (oportunidad_id, contacto_id)
);
CREATE TABLE public.crm_actividad_empresa (
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  actividad_id uuid NOT NULL REFERENCES public.crm_actividades(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.crm_empresas(id) ON DELETE CASCADE,
  PRIMARY KEY (actividad_id, empresa_id)
);
CREATE TABLE public.crm_actividad_contacto (
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  actividad_id uuid NOT NULL REFERENCES public.crm_actividades(id) ON DELETE CASCADE,
  contacto_id uuid NOT NULL REFERENCES public.crm_contactos(id) ON DELETE CASCADE,
  PRIMARY KEY (actividad_id, contacto_id)
);
-- Una actividad tiene como máximo UNA oportunidad.
ALTER TABLE public.crm_actividades
  ADD COLUMN oportunidad_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL;
CREATE INDEX idx_crm_actividades_oportunidad ON public.crm_actividades(oportunidad_id);

-- 3) Propiedades configurables (definición global, administrada por Libre Carga)
CREATE TABLE public.crm_propiedades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objeto text NOT NULL CHECK (objeto IN ('empresa','contacto','oportunidad','actividad')),
  clave text NOT NULL,
  etiqueta text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('seleccion','multiseleccion','numero','fecha','texto')),
  obligatoria boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 0,
  archivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (objeto, clave)
);
CREATE TABLE public.crm_propiedad_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id uuid NOT NULL REFERENCES public.crm_propiedades(id) ON DELETE RESTRICT,
  etiqueta text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  archivada boolean NOT NULL DEFAULT false,
  -- Renombrar = crear opción nueva que reemplaza a la anterior (archivada).
  reemplaza_a uuid REFERENCES public.crm_propiedad_opciones(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crm_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id(),
  propiedad_id uuid NOT NULL REFERENCES public.crm_propiedades(id) ON DELETE RESTRICT,
  registro_id uuid NOT NULL,
  valor_texto text,
  valor_numero numeric,
  valor_fecha date,
  opcion_ids uuid[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (propiedad_id, registro_id)
);
CREATE INDEX idx_crm_valores_registro ON public.crm_valores(registro_id);
CREATE INDEX idx_crm_valores_org_prop ON public.crm_valores(organization_id, propiedad_id);

-- 4) Permisos de la Data API
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.crm_empresas, public.crm_contactos, public.crm_empresa_contacto,
  public.crm_oportunidad_empresa, public.crm_oportunidad_contacto,
  public.crm_actividad_empresa, public.crm_actividad_contacto, public.crm_valores
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_propiedades, public.crm_propiedad_opciones TO authenticated;
GRANT ALL ON
  public.crm_empresas, public.crm_contactos, public.crm_empresa_contacto,
  public.crm_oportunidad_empresa, public.crm_oportunidad_contacto,
  public.crm_actividad_empresa, public.crm_actividad_contacto, public.crm_valores,
  public.crm_propiedades, public.crm_propiedad_opciones
  TO service_role;

-- 5) RLS: datos aislados por organización; definiciones sólo las escribe super_admin.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_empresas','crm_contactos','crm_empresa_contacto',
    'crm_oportunidad_empresa','crm_oportunidad_contacto','crm_actividad_empresa',
    'crm_actividad_contacto','crm_valores']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "%s_org" ON public.%I FOR ALL TO authenticated
      USING (organization_id = public.current_user_org_id())
      WITH CHECK (organization_id = public.current_user_org_id())$p$, t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['crm_propiedades','crm_propiedad_opciones']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY "%s_leer" ON public.%I FOR SELECT TO authenticated USING (true)$p$, t, t);
    EXECUTE format($p$CREATE POLICY "%s_admin" ON public.%I FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'))
      WITH CHECK (public.has_role(auth.uid(), 'super_admin'))$p$, t, t);
  END LOOP;
END $$;

-- 6) Migración de datos existentes (idempotente por lead_origen_id)
INSERT INTO public.crm_empresas (organization_id, nombre, lead_origen_id, cliente_id, created_by, created_at)
SELECT l.organization_id, l.empresa, l.id, l.cliente_convertido_id, l.created_by, l.created_at
FROM public.crm_leads l
WHERE l.deleted_at IS NULL AND COALESCE(trim(l.empresa), '') <> ''
ON CONFLICT (lead_origen_id) DO NOTHING;

INSERT INTO public.crm_contactos (organization_id, nombre, email, telefono, lead_origen_id, created_by, created_at)
SELECT l.organization_id, l.contacto, l.email, l.telefono, l.id, l.created_by, l.created_at
FROM public.crm_leads l
WHERE l.deleted_at IS NULL AND COALESCE(trim(l.contacto), '') <> ''
ON CONFLICT (lead_origen_id) DO NOTHING;

INSERT INTO public.crm_empresa_contacto (organization_id, empresa_id, contacto_id)
SELECT e.organization_id, e.id, c.id
FROM public.crm_empresas e JOIN public.crm_contactos c ON c.lead_origen_id = e.lead_origen_id
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_oportunidad_empresa (organization_id, oportunidad_id, empresa_id)
SELECT o.organization_id, o.id, e.id
FROM public.crm_oportunidades o JOIN public.crm_empresas e ON e.lead_origen_id = o.lead_id
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_oportunidad_contacto (organization_id, oportunidad_id, contacto_id)
SELECT o.organization_id, o.id, c.id
FROM public.crm_oportunidades o JOIN public.crm_contactos c ON c.lead_origen_id = o.lead_id
ON CONFLICT DO NOTHING;

UPDATE public.crm_actividades a SET oportunidad_id = a.entidad_id
WHERE a.entidad_tipo = 'oportunidad' AND a.oportunidad_id IS NULL
  AND EXISTS (SELECT 1 FROM public.crm_oportunidades o WHERE o.id = a.entidad_id);

INSERT INTO public.crm_actividad_empresa (organization_id, actividad_id, empresa_id)
SELECT a.organization_id, a.id, e.id
FROM public.crm_actividades a JOIN public.crm_empresas e ON e.lead_origen_id = a.entidad_id
WHERE a.entidad_tipo = 'lead'
ON CONFLICT DO NOTHING;

INSERT INTO public.crm_actividad_contacto (organization_id, actividad_id, contacto_id)
SELECT a.organization_id, a.id, c.id
FROM public.crm_actividades a JOIN public.crm_contactos c ON c.lead_origen_id = a.entidad_id
WHERE a.entidad_tipo = 'lead'
ON CONFLICT DO NOTHING;