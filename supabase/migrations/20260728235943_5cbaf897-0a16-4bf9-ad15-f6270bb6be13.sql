-- v13.322.1 (GHA-audit · audit:rpc-columns) — Schema drift real en
-- public.pnl_financiero_embarque: referenciaba `fc.subtotal`
-- (conceptos_factura sólo tiene `total`) y `pfc.subtotal` / `pfc.total`
-- (proveedor_facturas_conceptos sólo tiene `monto`). Al ser plpgsql, el error
-- sólo aparecía en runtime al abrir el P&L del embarque.
-- Se reescribe la definición vigente aplicando únicamente esos reemplazos,
-- sin tocar el resto del cuerpo.
DO $mig$
DECLARE
  _def text;
  _new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO _def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'pnl_financiero_embarque';

  IF _def IS NULL THEN
    RAISE EXCEPTION 'pnl_financiero_embarque no existe';
  END IF;

  _new := replace(_def, 'coalesce(fc.subtotal,0)', 'coalesce(fc.total,0)');
  _new := replace(_new, 'coalesce(fc.subtotal, 0)', 'coalesce(fc.total, 0)');
  _new := replace(_new, 'coalesce(pfc.subtotal, pfc.total, 0)', 'coalesce(pfc.monto, 0)');

  IF _new = _def THEN
    RAISE NOTICE 'pnl_financiero_embarque ya estaba corregida; no se aplicaron cambios';
    RETURN;
  END IF;

  IF _new LIKE '%fc.subtotal%' OR _new LIKE '%pfc.subtotal%' OR _new LIKE '%pfc.total%' THEN
    RAISE EXCEPTION 'Quedaron referencias a columnas inexistentes tras el reemplazo';
  END IF;

  EXECUTE _new;
END
$mig$;

REVOKE EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pnl_financiero_embarque(uuid) TO authenticated, service_role;