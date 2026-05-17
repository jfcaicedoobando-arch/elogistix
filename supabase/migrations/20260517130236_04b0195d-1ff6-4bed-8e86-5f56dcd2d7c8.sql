REVOKE EXECUTE ON FUNCTION public.notificacion_cliente_marcar_leida(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notificaciones_cliente_marcar_todas_leidas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notificacion_cliente_marcar_leida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificaciones_cliente_marcar_todas_leidas() TO authenticated;