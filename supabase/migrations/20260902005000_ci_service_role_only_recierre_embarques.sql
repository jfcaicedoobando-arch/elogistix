-- v13.777.8 · Re-cierre del candado service_role-only.
-- La migración 20260902003000 (fix numeric/integer de RPCs de embarques)
-- reemitió `_crear_embarque_replicar_conceptos` con GRANT a `authenticated`,
-- reabriendo una función interna que el candado de CI
-- (supabase/tests/rls/_ci_check_service_role_only.sql) exige cerrada.
-- Sólo se invoca desde `crear_embarque_completo` (SECURITY DEFINER), por lo que
-- revocarla no afecta al frontend.
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;