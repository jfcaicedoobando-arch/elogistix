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
  FROM public.facturas
  WHERE id = NEW.factura_id AND organization_id = NEW.organization_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REP_FACTURA_NO_VIVA: la factura no está disponible para REP'
      USING ERRCODE = 'check_violation';
  END IF;

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
