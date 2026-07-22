-- 1) Revocar EXECUTE a anon en funciones internas que no deben ser públicas.
REVOKE EXECUTE ON FUNCTION public.es_admin_catalogo(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.es_escritor_financiero(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_pago_factura_no_sobrepago() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_pago_proveedor_no_sobrepago() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_reverse_ajustes_factura_proveedor() FROM anon, PUBLIC;

-- Los helpers los sigue usando authenticated (policies), pnl_financiero_embarque también.
GRANT EXECUTE ON FUNCTION public.es_admin_catalogo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.es_escritor_financiero(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated, service_role;

-- 2) Mover pg_trgm a schema dedicado 'extensions'.
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 3) Policy explícita "deny-all" en ratelimit_buckets. La tabla solo se toca
--    desde public.check_ratelimit (SECURITY DEFINER), que bypasea RLS.
DROP POLICY IF EXISTS "ratelimit_buckets deny direct access" ON public.ratelimit_buckets;
CREATE POLICY "ratelimit_buckets deny direct access"
ON public.ratelimit_buckets
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);