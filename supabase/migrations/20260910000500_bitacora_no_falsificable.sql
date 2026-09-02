-- DEFECTO 8 (P1 seguridad/auditoría): bitacora_actividad aceptaba INSERT
-- directo del cliente autenticado (policy "Tenant insert bitacora" + GRANT
-- INSERT a authenticated), permitiendo fabricar entradas con usuario_id /
-- email / modulo arbitrarios. La escritura ahora sólo es posible vía
-- `public.registrar_bitacora(...)` (SECURITY DEFINER), que ya deriva
-- usuario_id/email del servidor (auth.uid() / auth.users) desde FIX BL-02
-- (20260812173006) — aquí sólo se cierra la puerta de INSERT directo.

DROP POLICY IF EXISTS "Tenant insert bitacora" ON public.bitacora_actividad;
DROP POLICY IF EXISTS "Autenticados pueden insertar bitacora" ON public.bitacora_actividad;

REVOKE INSERT ON public.bitacora_actividad FROM authenticated;
REVOKE INSERT ON public.bitacora_actividad FROM anon;
REVOKE INSERT ON public.bitacora_actividad FROM PUBLIC;

-- La RPC ya deriva usuario_id/email del servidor; se restringe además su
-- ejecución sólo a `authenticated` (nunca `anon`).
REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) TO authenticated;
