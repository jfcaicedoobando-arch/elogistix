CREATE TABLE IF NOT EXISTS public.proveedor_alias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  alias_normalizado text NOT NULL,
  alias_original text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_alias TO authenticated;
GRANT ALL ON public.proveedor_alias TO service_role;

ALTER TABLE public.proveedor_alias ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS proveedor_alias_org_alias_uq
  ON public.proveedor_alias (organization_id, alias_normalizado);
CREATE INDEX IF NOT EXISTS proveedor_alias_proveedor_idx
  ON public.proveedor_alias (proveedor_id);

DROP POLICY IF EXISTS "Tenant read proveedor_alias" ON public.proveedor_alias;
CREATE POLICY "Tenant read proveedor_alias" ON public.proveedor_alias
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT public.current_user_org_id())
    OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "Tenant write proveedor_alias" ON public.proveedor_alias;
CREATE POLICY "Tenant write proveedor_alias" ON public.proveedor_alias
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      organization_id = (SELECT public.current_user_org_id())
      OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
    AND (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'admin_org'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'operador'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'contador'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Admin delete proveedor_alias" ON public.proveedor_alias;
CREATE POLICY "Admin delete proveedor_alias" ON public.proveedor_alias
  FOR DELETE TO authenticated
  USING (
    (
      organization_id = (SELECT public.current_user_org_id())
      OR public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)
    )
    AND public.es_admin_catalogo((SELECT auth.uid()))
  );