-- FIX-H6-12: re-aplica REVOKE/GRANT de assert_movimiento_pago_consistente()
-- (recreada en 20260810195819 sin el bloque de permisos en el mismo archivo).
REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_movimiento_pago_consistente() TO authenticated, service_role;