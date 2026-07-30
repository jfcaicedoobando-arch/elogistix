-- 1) Sync de monto/moneda/cliente de la oportunidad desde su cotización
CREATE OR REPLACE FUNCTION public._crm_sync_oportunidad_desde_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.oportunidad_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.crm_oportunidades o
     SET monto_estimado = COALESCE(NULLIF(NEW.subtotal, 0), o.monto_estimado),
         moneda         = COALESCE(NEW.moneda::text, o.moneda),
         cliente_id     = COALESCE(o.cliente_id, NEW.cliente_id),
         updated_at     = now()
   WHERE o.id = NEW.oportunidad_id
     AND (
       COALESCE(o.monto_estimado, 0) <> COALESCE(NULLIF(NEW.subtotal, 0), o.monto_estimado, 0)
       OR COALESCE(o.moneda, '') <> COALESCE(NEW.moneda::text, o.moneda, '')
       OR (o.cliente_id IS NULL AND NEW.cliente_id IS NOT NULL)
     );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_crm_sync_oportunidad_desde_cotizacion ON public.cotizaciones;
CREATE TRIGGER trg_crm_sync_oportunidad_desde_cotizacion
  AFTER INSERT OR UPDATE OF subtotal, moneda, cliente_id, oportunidad_id ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public._crm_sync_oportunidad_desde_cotizacion();

-- 2) RLS: incluir gerente_comercial y admin_org en el CRUD del CRM
DROP POLICY IF EXISTS "Staff CRUD crm_leads" ON public.crm_leads;
CREATE POLICY "Staff CRUD crm_leads" ON public.crm_leads
FOR ALL TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
  AND (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.has_role((SELECT auth.uid()), 'admin_org')
    OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
    OR public.has_role((SELECT auth.uid()), 'operador')
    OR public.has_role((SELECT auth.uid()), 'super_admin')
  )
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
  AND (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.has_role((SELECT auth.uid()), 'admin_org')
    OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
    OR public.has_role((SELECT auth.uid()), 'operador')
    OR public.has_role((SELECT auth.uid()), 'super_admin')
  )
);

DROP POLICY IF EXISTS "Staff CRUD crm_oportunidades" ON public.crm_oportunidades;
CREATE POLICY "Staff CRUD crm_oportunidades" ON public.crm_oportunidades
FOR ALL TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
  AND (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.has_role((SELECT auth.uid()), 'admin_org')
    OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
    OR public.has_role((SELECT auth.uid()), 'operador')
    OR public.has_role((SELECT auth.uid()), 'super_admin')
  )
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
  AND (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.has_role((SELECT auth.uid()), 'admin_org')
    OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
    OR public.has_role((SELECT auth.uid()), 'operador')
    OR public.has_role((SELECT auth.uid()), 'super_admin')
  )
);

DROP POLICY IF EXISTS "Staff CRUD crm_actividades" ON public.crm_actividades;
CREATE POLICY "Staff CRUD crm_actividades" ON public.crm_actividades
FOR ALL TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
  AND (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.has_role((SELECT auth.uid()), 'admin_org')
    OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
    OR public.has_role((SELECT auth.uid()), 'operador')
    OR public.has_role((SELECT auth.uid()), 'super_admin')
  )
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
  AND (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.has_role((SELECT auth.uid()), 'admin_org')
    OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
    OR public.has_role((SELECT auth.uid()), 'operador')
    OR public.has_role((SELECT auth.uid()), 'super_admin')
  )
);