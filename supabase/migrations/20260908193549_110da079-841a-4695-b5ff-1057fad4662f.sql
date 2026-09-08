CREATE TABLE public.catalogo_org_desactivado (
  organization_id uuid NOT NULL DEFAULT public.current_user_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  catalogo text NOT NULL CHECK (catalogo IN ('puertos','navieras','tipos_contenedor')),
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  PRIMARY KEY (organization_id, catalogo, item_id)
);

GRANT SELECT, INSERT, DELETE ON public.catalogo_org_desactivado TO authenticated;
GRANT ALL ON public.catalogo_org_desactivado TO service_role;

ALTER TABLE public.catalogo_org_desactivado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read catalogo_org_desactivado"
ON public.catalogo_org_desactivado FOR SELECT TO authenticated
USING (organization_id = (SELECT public.org_scope()));

CREATE POLICY "Admin catalogo apaga por org"
ON public.catalogo_org_desactivado FOR INSERT TO authenticated
WITH CHECK (
  organization_id = (SELECT public.org_scope())
  AND (SELECT public.es_admin_catalogo(auth.uid()))
);

CREATE POLICY "Admin catalogo enciende por org"
ON public.catalogo_org_desactivado FOR DELETE TO authenticated
USING (
  organization_id = (SELECT public.org_scope())
  AND (SELECT public.es_admin_catalogo(auth.uid()))
);

CREATE INDEX idx_catalogo_org_desactivado_lookup
ON public.catalogo_org_desactivado (organization_id, catalogo);