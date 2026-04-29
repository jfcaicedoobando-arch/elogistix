CREATE TABLE public.auditoria_revisiones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL DEFAULT current_user_org_id(),
  embarque_id UUID NOT NULL,
  regla TEXT NOT NULL,
  detalle_hash TEXT NOT NULL,
  detalle TEXT NOT NULL DEFAULT '',
  accion_tomada TEXT NOT NULL DEFAULT '',
  revisado_por UUID NOT NULL DEFAULT auth.uid(),
  revisado_por_email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX auditoria_revisiones_unq
  ON public.auditoria_revisiones (organization_id, embarque_id, regla, detalle_hash);

CREATE INDEX auditoria_revisiones_org_idx
  ON public.auditoria_revisiones (organization_id);

ALTER TABLE public.auditoria_revisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant CRUD auditoria_revisiones"
ON public.auditoria_revisiones
FOR ALL
TO authenticated
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Tenant viewer auditoria_revisiones"
ON public.auditoria_revisiones
FOR SELECT
TO authenticated
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND has_role(auth.uid(), 'viewer'::app_role)
);

CREATE TRIGGER trg_auditoria_revisiones_updated_at
BEFORE UPDATE ON public.auditoria_revisiones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();