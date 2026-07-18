-- ============================================================
-- Fase F: candados server-side para pagos, REP y notas de crédito
-- v13.301.75 — auditoría de cadena de facturación (Bugs 8, 10, 11)
-- ============================================================

-- Función auxiliar: saldo bruto = total - pagos vivos (sin restar NCs).
-- Se usa dentro del guard de NCs para permitir comparar el saldo antes
-- de aplicar la NC en curso (evita auto-restarse en el UPDATE).
CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN f.estado IN ('Cancelada','Sustituida','Borrador') THEN 0
    ELSE COALESCE(f.total, 0)
       - COALESCE((
           SELECT SUM(pf.monto_aplicado_factura)
           FROM public.pagos_factura pf
           WHERE pf.factura_id = f.id
             AND pf.deleted_at IS NULL
         ), 0)
  END
  FROM public.facturas f
  WHERE f.id = p_factura_id
$$;

GRANT EXECUTE ON FUNCTION public.saldo_factura_bruto(uuid) TO authenticated, service_role;

-- ---------- Bug 8a: pagos CxC contra facturas vivas ------------
CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_saldo_actual numeric;
  v_saldo_previo_pago numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT estado::text INTO v_estado FROM public.facturas WHERE id = NEW.factura_id;
  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_PAGO_FACTURA_NO_VIVA: la factura está en estado % y no admite pagos', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  -- Sobrepago: saldo bruto (sin NCs) - suma de pagos vivos (incluyendo la fila NEW).
  v_saldo_actual := public.saldo_factura_bruto(NEW.factura_id)
    - COALESCE((
        SELECT SUM(pf.monto_aplicado_factura)
        FROM public.pagos_factura pf
        WHERE pf.factura_id = NEW.factura_id
          AND pf.deleted_at IS NULL
          AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      ), 0)
    - COALESCE(NEW.monto_aplicado_factura, 0);

  IF v_saldo_actual < -0.01 THEN
    v_saldo_previo_pago := v_saldo_actual + COALESCE(NEW.monto_aplicado_factura, 0);
    RAISE EXCEPTION 'LC_PAGO_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'saldo_disponible', v_saldo_previo_pago,
              'monto_intentado', NEW.monto_aplicado_factura
            )::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_factura_viva ON public.pagos_factura;
CREATE TRIGGER trg_pago_factura_viva
  BEFORE INSERT OR UPDATE ON public.pagos_factura
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.assert_factura_viva_para_pago();

-- ---------- Bug 8b: pagos CxP contra proveedor_facturas vivas ------------
CREATE OR REPLACE FUNCTION public.assert_proveedor_factura_viva_para_pago()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT estado::text INTO v_estado
  FROM public.proveedor_facturas WHERE id = NEW.proveedor_factura_id;

  IF v_estado = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_PAGO_CXP_NO_VIVA: la factura de proveedor está cancelada'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pago_proveedor_factura_viva ON public.pagos_proveedor;
CREATE TRIGGER trg_pago_proveedor_factura_viva
  BEFORE INSERT OR UPDATE ON public.pagos_proveedor
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NULL)
  EXECUTE FUNCTION public.assert_proveedor_factura_viva_para_pago();

-- ---------- Bug 10: REP sólo sobre facturas timbradas y vivas ------------
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
  IF NEW.uuid_rep IS NULL
     AND NEW.facturapi_rep_id IS NULL
     AND (NEW.estado_rep IS NULL OR NEW.estado_rep IN ('','pendiente','cancelado'))
  THEN
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

DROP TRIGGER IF EXISTS trg_pago_factura_rep_viva ON public.pagos_factura;
CREATE TRIGGER trg_pago_factura_rep_viva
  BEFORE INSERT OR UPDATE OF uuid_rep, estado_rep, facturapi_rep_id ON public.pagos_factura
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_factura_viva_para_rep();

-- ---------- Bug 11: NC no puede exceder saldo pendiente ------------
CREATE OR REPLACE FUNCTION public.assert_nc_no_excede_saldo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_saldo_bruto numeric;
  v_ncs_previas numeric;
  v_total_ncs numeric;
BEGIN
  -- Sólo restringe NCs vivas y aplicadas (borradores y canceladas se permiten).
  IF NEW.deleted_at IS NOT NULL OR NEW.estado::text NOT IN ('Aplicada','Emitida') THEN
    RETURN NEW;
  END IF;

  v_saldo_bruto := public.saldo_factura_bruto(NEW.factura_id);

  SELECT COALESCE(SUM(nc.monto), 0) INTO v_ncs_previas
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = NEW.factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado::text IN ('Aplicada','Emitida')
    AND nc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_total_ncs := v_ncs_previas + COALESCE(NEW.monto, 0);

  IF v_total_ncs > v_saldo_bruto + 0.01 THEN
    RAISE EXCEPTION 'LC_NC_EXCEDE_SALDO: la nota de crédito excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'saldo_disponible', v_saldo_bruto - v_ncs_previas,
              'monto_intentado', NEW.monto
            )::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nc_no_excede_saldo ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_no_excede_saldo
  BEFORE INSERT OR UPDATE ON public.factura_notas_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_nc_no_excede_saldo();

COMMENT ON FUNCTION public.saldo_factura_bruto(uuid) IS
  'Fase F v13.301.75: total − pagos vivos, sin restar NCs. Se usa en el guard de NCs para permitir validar sin auto-restarse.';
COMMENT ON FUNCTION public.assert_factura_viva_para_pago() IS
  'Fase F v13.301.75 (Bug 8): bloquea pagos sobre facturas Cancelada/Sustituida/Borrador y previene sobrepagos.';
COMMENT ON FUNCTION public.assert_proveedor_factura_viva_para_pago() IS
  'Fase F v13.301.75 (Bug 8): bloquea pagos sobre proveedor_facturas Cancelada.';
COMMENT ON FUNCTION public.assert_factura_viva_para_rep() IS
  'Fase F v13.301.75 (Bug 10): exige factura timbrada y viva antes de timbrar REP.';
COMMENT ON FUNCTION public.assert_nc_no_excede_saldo() IS
  'Fase F v13.301.75 (Bug 11): impide que las NCs excedan el saldo pendiente.';