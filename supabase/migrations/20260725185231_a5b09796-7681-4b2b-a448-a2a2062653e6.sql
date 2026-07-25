-- H6 fix: revocar acceso PUBLIC/anon y otorgar EXECUTE explícito a
-- las tres funciones SECURITY DEFINER creadas en migraciones 172648 / 174719
-- sin el patrón canónico. Cierra el gate audit:migrations sin editar las
-- migraciones ya aplicadas.

REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.cxp_aging_proveedores(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cxp_aging_proveedores(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.profit_por_embarque() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profit_por_embarque() FROM anon;
GRANT EXECUTE ON FUNCTION public.profit_por_embarque() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profit_por_embarque() TO service_role;