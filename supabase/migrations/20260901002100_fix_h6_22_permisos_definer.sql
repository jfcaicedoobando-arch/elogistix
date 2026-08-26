-- FIX-H6-22: re-aplicar permisos explícitos de funciones SECURITY DEFINER
-- re-emitidas en 20260826030340, 20260901001400 y 20260901001500 sin el
-- bloque REVOKE/GRANT en el mismo archivo (higiene H6).
REVOKE ALL ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO service_role;