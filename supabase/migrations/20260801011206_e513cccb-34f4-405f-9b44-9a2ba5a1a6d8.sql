-- FIX-H6-06: re-aplica REVOKE/GRANT explícitos sobre funciones SECURITY DEFINER
-- creadas en 20260801005827 (comisiones / exclusión sin_comision).

REVOKE ALL ON FUNCTION public.resolver_sin_comision(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO service_role;