-- Aplica en producción el cierre de escritura directa a la bitácora que nunca
-- llegó (supabase/migrations/20260910000500, revisado 2026-11-08). La app
-- escribe por public.registrar_bitacora (SECURITY DEFINER, deriva usuario del
-- servidor); las funciones Edge usan service_role y los triggers son DEFINER.

DROP POLICY IF EXISTS "Tenant insert bitacora" ON public.bitacora_actividad;
DROP POLICY IF EXISTS "Autenticados pueden insertar bitacora" ON public.bitacora_actividad;

REVOKE INSERT ON public.bitacora_actividad FROM authenticated;
REVOKE INSERT ON public.bitacora_actividad FROM anon;
REVOKE INSERT ON public.bitacora_actividad FROM PUBLIC;

REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) TO authenticated;