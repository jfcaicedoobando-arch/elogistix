-- Defecto 5 (P1): assert_nc_no_excede_saldo() no bloqueaba la factura al leer
-- moneda/tipo_cambio/fecha_emision, así que dos NC concurrentes podían
-- sobreacreditar (race condition clásica read-then-write sin lock).
CREATE OR REPLACE FUNCTION public.assert_nc_no_excede_saldo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fac record;
  v_saldo_doc numeric;
  v_saldo_mxn numeric;
  v_ncs_previas_mxn numeric;
  v_nc_nueva_mxn numeric;
  v_total_ncs_mxn numeric;
  v_tol_mxn numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.estado::text NOT IN ('Aplicada','Emitida') THEN
    RETURN NEW;
  END IF;
  SELECT f.moneda::text AS moneda, f.tipo_cambio, f.fecha_emision
    INTO v_fac
  FROM public.facturas f
  WHERE f.id = NEW.factura_id
    AND f.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  v_saldo_doc := public.saldo_factura_bruto(NEW.factura_id);
  v_saldo_mxn := public.a_mxn_doc(v_saldo_doc, v_fac.moneda, v_fac.fecha_emision, v_fac.tipo_cambio, NULL);
  v_nc_nueva_mxn := public.a_mxn_doc(
    COALESCE(NEW.monto, 0),
    COALESCE(NEW.moneda::text, v_fac.moneda),
    COALESCE(NEW.fecha_emision, v_fac.fecha_emision),
    NEW.tipo_cambio,
    v_fac.tipo_cambio
  );
  IF v_saldo_mxn IS NULL OR v_nc_nueva_mxn IS NULL THEN
    RAISE EXCEPTION 'LC_NC_SIN_TC: no hay tipo de cambio para validar la nota de crédito contra el saldo de la factura'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'moneda_factura', v_fac.moneda,
              'moneda_nota_credito', COALESCE(NEW.moneda::text, v_fac.moneda),
              'fecha_nota_credito', COALESCE(NEW.fecha_emision, v_fac.fecha_emision)
            )::text;
  END IF;
  SELECT COALESCE(SUM(
           public.a_mxn_doc(
             nc.monto,
             COALESCE(nc.moneda::text, v_fac.moneda),
             COALESCE(nc.fecha_emision, v_fac.fecha_emision),
             nc.tipo_cambio,
             v_fac.tipo_cambio
           )
         ), 0)
    INTO v_ncs_previas_mxn
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = NEW.factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado::text IN ('Aplicada','Emitida')
    AND nc.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_total_ncs_mxn := v_ncs_previas_mxn + v_nc_nueva_mxn;
  v_tol_mxn := GREATEST(
    0.01,
    COALESCE(public.a_mxn_doc(0.01, v_fac.moneda, v_fac.fecha_emision, v_fac.tipo_cambio, NULL), 0.01)
  );
  IF v_total_ncs_mxn > v_saldo_mxn + v_tol_mxn THEN
    RAISE EXCEPTION 'LC_NC_EXCEDE_SALDO: la nota de crédito excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'moneda_factura', v_fac.moneda,
              'saldo_disponible_mxn', round(v_saldo_mxn - v_ncs_previas_mxn, 2),
              'monto_intentado_mxn', round(v_nc_nueva_mxn, 2),
              'monto_intentado', NEW.monto,
              'moneda_nota_credito', COALESCE(NEW.moneda::text, v_fac.moneda)
            )::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Defecto 6 (P1): historia de cobros inmutable frente a REP vivos.
CREATE OR REPLACE FUNCTION public.assert_pago_no_altera_historia_rep() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_factura_id uuid;
  v_row_id uuid;
  v_row_fecha date;
  v_row_ts timestamptz;
  v_row_deleted timestamptz;
  v_changed boolean := true;
  v_boundary_fecha date;
  v_boundary_ts timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_factura_id := OLD.factura_id;
    v_row_id := OLD.id;
    v_row_fecha := OLD.fecha_pago;
    v_row_ts := OLD.created_at;
    v_row_deleted := OLD.deleted_at;
  ELSIF TG_OP = 'UPDATE' THEN
    v_factura_id := OLD.factura_id;
    v_row_id := OLD.id;
    v_row_fecha := OLD.fecha_pago;
    v_row_ts := OLD.created_at;
    v_row_deleted := OLD.deleted_at;
    v_changed := (NEW.fecha_pago IS DISTINCT FROM OLD.fecha_pago)
      OR (NEW.monto IS DISTINCT FROM OLD.monto)
      OR (NEW.monto_aplicado_factura IS DISTINCT FROM OLD.monto_aplicado_factura)
      OR (NEW.moneda IS DISTINCT FROM OLD.moneda)
      OR (NEW.tipo_cambio IS DISTINCT FROM OLD.tipo_cambio)
      OR (NEW.factura_id IS DISTINCT FROM OLD.factura_id)
      OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at)
      OR (NEW.created_at IS DISTINCT FROM OLD.created_at);
  ELSE
    IF NEW.deleted_at IS NOT NULL THEN
      RETURN NEW;
    END IF;
    v_factura_id := NEW.factura_id;
    v_row_id := NEW.id;
    v_row_fecha := NEW.fecha_pago;
    v_row_ts := NEW.created_at;
    v_row_deleted := NULL;
  END IF;

  IF TG_OP <> 'INSERT' AND v_row_deleted IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  SELECT pf.fecha_pago, pf.created_at
    INTO v_boundary_fecha, v_boundary_ts
  FROM public.pagos_factura pf
  WHERE pf.factura_id = v_factura_id
    AND pf.id <> v_row_id
    AND pf.deleted_at IS NULL
    AND pf.uuid_rep IS NOT NULL
    AND pf.estado_rep = 'Timbrado'
    AND pf.rep_cancelado_en IS NULL
  ORDER BY pf.fecha_pago DESC, pf.created_at DESC
  LIMIT 1;

  IF v_boundary_fecha IS NOT NULL
     AND (v_row_fecha, v_row_ts) <= (v_boundary_fecha, v_boundary_ts) THEN
    RAISE EXCEPTION 'LC_REP_HISTORIA_INMUTABLE: este movimiento es anterior a un complemento de pago (REP) timbrado y vigente de la factura; cancela y reemite los REP afectados antes de modificar la historia de cobros'
      USING ERRCODE = 'P0001',
            HINT    = json_build_object(
              'factura_id', v_factura_id,
              'rep_fecha_pago', v_boundary_fecha
            )::text;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_pago_no_altera_historia_rep() FROM PUBLIC;
GRANT ALL ON FUNCTION public.assert_pago_no_altera_historia_rep() TO authenticated;
GRANT ALL ON FUNCTION public.assert_pago_no_altera_historia_rep() TO service_role;

DROP TRIGGER IF EXISTS trg_pago_no_altera_historia_rep ON public.pagos_factura;
CREATE TRIGGER trg_pago_no_altera_historia_rep
  BEFORE INSERT OR UPDATE OR DELETE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.assert_pago_no_altera_historia_rep();

COMMENT ON FUNCTION public.assert_pago_no_altera_historia_rep() IS
  'Defecto 6 (auditoría 2026-09-10): rechaza INSERT/UPDATE/DELETE sobre pagos_factura que alteren la historia (fecha, monto, factura o baja) anterior o igual a un REP vivo (timbrado y no cancelado) de la misma factura. LC_REP_HISTORIA_INMUTABLE.';