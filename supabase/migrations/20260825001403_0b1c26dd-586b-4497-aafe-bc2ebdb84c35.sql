-- FIX4 · H6: ACLs explícitas de dos funciones SECURITY DEFINER cuyas
-- migraciones previas no las declaraban (avanzar_estado_embarque y el trigger
-- de signup). Idempotente.
REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_signup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_signup() FROM anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;
