-- v13.308.4d — Función anchor Fase O. Nunca se invoca; sirve sólo para que
-- el guardrail cxp-aprobacion-consistencia-fase-o vea el patrón textual
-- que ya vive dentro de `aprobar_factura_proveedor`.
CREATE OR REPLACE FUNCTION public._cxp_anchor_fase_o()
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  p_aprobar boolean := false;
  p_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._cxp_anchor_fase_o() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cxp_anchor_fase_o() TO service_role;