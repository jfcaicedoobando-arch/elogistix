CREATE TABLE IF NOT EXISTS public.comisiones_excepciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vendedora_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  embarque_id uuid REFERENCES public.embarques(id) ON DELETE CASCADE,
  porcentaje numeric(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  motivo text,
  activa boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT comisiones_excepciones_alcance_chk
    CHECK ((cliente_id IS NOT NULL) <> (embarque_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS comisiones_excepciones_cliente_uq
  ON public.comisiones_excepciones (organization_id, vendedora_id, cliente_id)
  WHERE cliente_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS comisiones_excepciones_embarque_uq
  ON public.comisiones_excepciones (organization_id, vendedora_id, embarque_id)
  WHERE embarque_id IS NOT NULL AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comisiones_excepciones TO authenticated;
GRANT ALL ON public.comisiones_excepciones TO service_role;

ALTER TABLE public.comisiones_excepciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comisiones_excepciones_admin_full" ON public.comisiones_excepciones
  FOR ALL TO authenticated
  USING (
    ((SELECT organization_id = public.current_user_org_id()) OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    AND (public.has_role((SELECT auth.uid()), 'admin'::app_role) OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((SELECT organization_id = public.current_user_org_id()) OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    AND (public.has_role((SELECT auth.uid()), 'admin'::app_role) OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  );

CREATE POLICY "comisiones_excepciones_tenant_restrictive"
  ON public.comisiones_excepciones AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id));

DROP TRIGGER IF EXISTS update_comisiones_excepciones_updated_at ON public.comisiones_excepciones;
CREATE TRIGGER update_comisiones_excepciones_updated_at
  BEFORE UPDATE ON public.comisiones_excepciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.resolver_porcentaje_comision(
  p_organization_id uuid,
  p_vendedora_id uuid,
  p_cliente_id uuid,
  p_embarque_id uuid
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT e.porcentaje
       FROM public.comisiones_excepciones e
      WHERE e.organization_id = p_organization_id
        AND e.vendedora_id = p_vendedora_id
        AND e.activa = true AND e.deleted_at IS NULL
        AND ((p_embarque_id IS NOT NULL AND e.embarque_id = p_embarque_id)
          OR (p_cliente_id IS NOT NULL AND e.cliente_id = p_cliente_id))
      ORDER BY (e.embarque_id IS NOT NULL) DESC
      LIMIT 1),
    (SELECT COALESCE(vc.porcentaje_default, 0)
       FROM public.vendedora_config vc
      WHERE vc.organization_id = p_organization_id
        AND vc.user_id = p_vendedora_id
        AND vc.activa = true),
    0
  );
$function$;

REVOKE ALL ON FUNCTION public.resolver_porcentaje_comision(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_porcentaje_comision(uuid, uuid, uuid, uuid) TO authenticated, service_role;