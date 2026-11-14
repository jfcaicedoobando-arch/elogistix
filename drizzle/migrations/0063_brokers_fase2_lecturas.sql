CREATE FUNCTION public.broker_mis_solicitudes()
RETURNS TABLE (id uuid, empresa text, organizacion text, estado text, motivo text, created_at timestamptz, resuelto_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.id, e.nombre, o.nombre, s.estado, s.motivo, s.created_at, s.resuelto_at
    FROM public.crm_broker_solicitudes s
    JOIN public.crm_brokers b ON b.id = s.broker_id AND b.user_id = auth.uid()
    JOIN public.crm_empresas e ON e.id = s.empresa_id
    JOIN public.organizations o ON o.id = s.organization_id
   ORDER BY s.created_at DESC LIMIT 100
$$;
REVOKE ALL ON FUNCTION public.broker_mis_solicitudes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_mis_solicitudes() TO authenticated;

-- Bandeja interna: admin/gerente comercial ven todas; el KAM sólo las de sus cuentas.
CREATE FUNCTION public.crm_broker_solicitudes_pendientes()
RETURNS TABLE (id uuid, broker text, empresa_id uuid, empresa text, rol_contacto text, relacion text, tiempo_cierre text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.id, b.nombre, e.id, e.nombre, s.rol_contacto, s.relacion, s.tiempo_cierre, s.created_at
    FROM public.crm_broker_solicitudes s
    JOIN public.crm_brokers b ON b.id = s.broker_id
    JOIN public.crm_empresas e ON e.id = s.empresa_id
   WHERE s.estado = 'pendiente' AND s.organization_id = public.org_scope()
     AND (public.has_any_role_in_org(auth.uid(), ARRAY['admin_org','gerente_comercial']::public.app_role[], s.organization_id)
          OR EXISTS (SELECT 1 FROM public.crm_oportunidad_empresa oe
               JOIN public.crm_oportunidades op ON op.id = oe.oportunidad_id AND op.deleted_at IS NULL
              WHERE oe.empresa_id = s.empresa_id AND op.vendedor_id = auth.uid()))
   ORDER BY s.created_at LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.crm_broker_solicitudes_pendientes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_broker_solicitudes_pendientes() TO authenticated;