
-- 1. Etapas del pipeline: columnas de auto-seguimiento
ALTER TABLE public.crm_etapas_pipeline
  ADD COLUMN IF NOT EXISTS crea_tarea_seguimiento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_seguimiento integer NOT NULL DEFAULT 3;

-- 2. Notificaciones in-app del CRM
CREATE TABLE IF NOT EXISTS public.crm_notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL DEFAULT '',
  link text,
  leida_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notif_user_unread
  ON public.crm_notificaciones (user_id, leida_at NULLS FIRST, created_at DESC);

ALTER TABLE public.crm_notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario lee sus notificaciones"
  ON public.crm_notificaciones FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Usuario marca leida su notificacion"
  ON public.crm_notificaciones FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff inserta notificaciones org"
  ON public.crm_notificaciones FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id = current_user_org_id()
      AND (has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'operador'::app_role)
        OR has_role(auth.uid(), 'vendedor'::app_role)))
    OR has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Super admin lee todas notificaciones"
  ON public.crm_notificaciones FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Plantillas de mensaje (email / WhatsApp)
CREATE TABLE IF NOT EXISTS public.crm_plantillas_mensaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  nombre text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  asunto text NOT NULL DEFAULT '',
  cuerpo text NOT NULL DEFAULT '',
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_crm_plantillas_org_canal
  ON public.crm_plantillas_mensaje (organization_id, canal, activa);

ALTER TABLE public.crm_plantillas_mensaje ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hide soft deleted crm_plantillas_mensaje"
  ON public.crm_plantillas_mensaje AS RESTRICTIVE FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (true);

CREATE POLICY "Tenant read crm_plantillas_mensaje"
  ON public.crm_plantillas_mensaje FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant admin crm_plantillas_mensaje"
  ON public.crm_plantillas_mensaje FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );
