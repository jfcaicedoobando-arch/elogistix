-- H6: privilegios canónicos de public.ejecutar_pago_programado tras su reemisión en M3.
-- Sin expandir acceso: los mismos roles que tenía antes (sólo `authenticated`).
REVOKE ALL ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text, uuid) TO authenticated;