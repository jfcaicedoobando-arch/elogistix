-- Hotfix Fase F v13.301.76: ajustar early-exit del guard de REP.
-- Bug: estado_rep tiene default 'NoAplica' que no matcheaba el early-exit,
-- por lo que cualquier pago sobre facturas sin uuid_fiscal fallaba.

CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_rep()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_uuid_fiscal text;
BEGIN
  -- Sólo validamos cuando la fila realmente está timbrando un REP.
  -- Un pago sin uuid_rep ni facturapi_rep_id no timbra REP por definición,
  -- sin importar el valor de estado_rep (que puede ser 'NoAplica' por default).
  IF NEW.uuid_rep IS NULL AND NEW.facturapi_rep_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT estado::text, uuid_fiscal
    INTO v_estado, v_uuid_fiscal
  FROM public.facturas WHERE id = NEW.factura_id;

  IF v_uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'LC_REP_FACTURA_SIN_TIMBRAR: no se puede timbrar REP de una factura sin UUID fiscal'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_REP_FACTURA_NO_VIVA: la factura está en estado % y no admite REP', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  RETURN NEW;
END;
$$;

-- Recrear el trigger con WHEN clause para cortar antes de invocar la función.
DROP TRIGGER IF EXISTS trg_pago_factura_rep_viva ON public.pagos_factura;
CREATE TRIGGER trg_pago_factura_rep_viva
  BEFORE INSERT OR UPDATE OF uuid_rep, estado_rep, facturapi_rep_id ON public.pagos_factura
  FOR EACH ROW
  WHEN (NEW.uuid_rep IS NOT NULL OR NEW.facturapi_rep_id IS NOT NULL)
  EXECUTE FUNCTION public.assert_factura_viva_para_rep();

COMMENT ON FUNCTION public.assert_factura_viva_para_rep() IS
  'Fase F v13.301.76 (Bug 10, hotfix): exige factura timbrada y viva antes de timbrar REP. Early-exit depende sólo de uuid_rep/facturapi_rep_id, no de estado_rep.';