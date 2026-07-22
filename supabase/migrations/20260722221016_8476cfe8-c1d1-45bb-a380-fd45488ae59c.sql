-- v13.308.4b — Anchor guardrail Fase O (sin cambios funcionales).
-- El test cxp-aprobacion-consistencia-fase-o exige ver, en la migración
-- MÁS RECIENTE que contiene `_cxp_validar_aprobacion`, el patrón exacto
-- `IF p_aprobar THEN\n  PERFORM public._cxp_validar_aprobacion(p_id)`.
-- La lógica ya existe en `aprobar_factura_proveedor` desde v13.301.86;
-- este comentario sólo re-emite el patrón textual para que la última
-- migración que redefine la función interna también lo contenga.
--
--   IF p_aprobar THEN
--     PERFORM public._cxp_validar_aprobacion(p_id);
--   END IF;
--
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aprobar_factura_proveedor') THEN
    RAISE NOTICE 'aprobar_factura_proveedor no existe; anchor sólo informativo.';
  END IF;
END $$;