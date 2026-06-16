-- Fix CI suite RLS: tablas públicas con políticas pero sin GRANT a authenticated.
-- PostgREST devuelve "permission denied" aunque las policies sean correctas.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;
GRANT ALL ON public.proveedores TO service_role;

-- Reaplicar por idempotencia (la suite financiero_critico reportaba permission denied)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuentas_bancarias TO authenticated;
GRANT ALL ON public.cuentas_bancarias TO service_role;