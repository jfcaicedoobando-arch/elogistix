-- FIX-H6-06: la migración 20260911000200 re-emitió _recompute_totales_embarque
-- (SECURITY DEFINER) sin REVOKE/GRANT en el mismo archivo. Forward-only: se
-- re-aplican los permisos canónicos (ya vigentes en la base). No cambia lógica.
REVOKE ALL ON FUNCTION public._recompute_totales_embarque(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._recompute_totales_embarque(uuid) TO service_role;