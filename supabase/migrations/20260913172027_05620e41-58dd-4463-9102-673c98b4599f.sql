-- FIX-H6-08 · Cierre de ACL de public.operaciones_stats()
--
-- La migración 20260913060931 re-emitió public.operaciones_stats() como
-- SECURITY DEFINER sin el bloque REVOKE/GRANT canónico. Esta migración
-- correctiva re-aplica los permisos de forma idempotente SIN tocar el cuerpo
-- de la función ni sus cálculos.
--
-- `authenticated` conserva EXECUTE: el dashboard de operaciones llama la RPC
-- directamente desde el cliente (src/features/operaciones/services/operacionesStats.ts).

REVOKE ALL ON FUNCTION public.operaciones_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.operaciones_stats() TO authenticated, service_role;