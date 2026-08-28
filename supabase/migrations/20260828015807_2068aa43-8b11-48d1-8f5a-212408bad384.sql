-- v13.777.6 — La migración 20260902005000 cerró nc_aplicadas_en_moneda_factura
-- a service_role, pero cartera_pendiente() es SECURITY INVOKER y la llama en
-- nombre del usuario final: el reporte de cartera rompía con 42501.
-- La tenancy sigue garantizada por RLS sobre facturas en el caller.
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO authenticated;