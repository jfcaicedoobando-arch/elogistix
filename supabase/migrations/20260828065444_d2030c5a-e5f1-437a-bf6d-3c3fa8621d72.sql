-- ==========================================================================
-- Ola E2 · Sub-ola A · Tesorería y aislamiento
-- Bugs: N5, N11, C3-res, N7, N15
-- ==========================================================================

-- --------------------------------------------------------------------------
-- N11 · el movimiento bancario debe cuadrar con el importe del pago
--      (se re-emite la función completa para agregar la validación de monto)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_movimiento_pago_consistente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pago_org uuid;
  v_pago_moneda text;
  v_pago_monto numeric;
  v_cuenta_moneda text;
  v_vinculos int;
  v_mov numeric;
  c_tol constant numeric := 1.00; -- tolerancia en la moneda del movimiento
BEGIN
  v_vinculos :=
      (CASE WHEN NEW.pago_factura_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.anticipo_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_factura_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.traspaso_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_vinculos > 1 THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_DOBLE_VINCULO: un movimiento no puede vincularse a más de un origen (pago de factura, pago de proveedor, lote de pago, anticipo o traspaso)'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT moneda::text INTO v_cuenta_moneda
    FROM public.cuentas_bancarias
    WHERE id = NEW.cuenta_bancaria_id AND deleted_at IS NULL;
  END IF;

  IF NEW.pago_factura_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0)
      INTO v_pago_org, v_pago_moneda, v_pago_monto
    FROM public.pagos_factura
    WHERE id = NEW.pago_factura_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de factura % no existe o está eliminado', NEW.pago_factura_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de factura pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N11: cobro ⇒ abono en la cuenta.
    v_mov := GREATEST(COALESCE(NEW.abono,0), COALESCE(NEW.cargo,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > c_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia %)',
        v_mov, v_pago_monto, c_tol
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0)
      INTO v_pago_org, v_pago_moneda, v_pago_monto
    FROM public.pagos_proveedor
    WHERE id = NEW.pago_proveedor_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor % no existe o está eliminado', NEW.pago_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    v_mov := GREATEST(COALESCE(NEW.cargo,0), COALESCE(NEW.abono,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > c_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia %)',
        v_mov, v_pago_monto, c_tol
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_proveedor_lote
    WHERE id = NEW.pago_proveedor_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_INEXISTENTE: el lote de pago % no existe o está eliminado', NEW.pago_proveedor_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de pago pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_factura_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_factura_lote
    WHERE id = NEW.pago_factura_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_COBRO_INEXISTENTE: el lote de cobro % no existe o está eliminado', NEW.pago_factura_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de cobro pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote de cobro (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.anticipo_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.anticipos_proveedor
    WHERE id = NEW.anticipo_proveedor_id;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_INEXISTENTE: el anticipo % no existe', NEW.anticipo_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el anticipo pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del anticipo (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM anon;

-- --------------------------------------------------------------------------
-- N5 · el trigger debe dispararse con TODAS las columnas de vínculo
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_movimiento_pago_consistente ON public.bbva_movimientos;
CREATE TRIGGER trg_movimiento_pago_consistente
BEFORE INSERT OR UPDATE OF
  pago_factura_id, pago_proveedor_id, cuenta_bancaria_id, organization_id,
  anticipo_proveedor_id, pago_proveedor_lote_id, pago_factura_lote_id,
  traspaso_id, cargo, abono
ON public.bbva_movimientos
FOR EACH ROW EXECUTE FUNCTION public.assert_movimiento_pago_consistente();

-- --------------------------------------------------------------------------
-- C3 residual · candado de tenant en las 3 tablas hijas de CxP
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_org_pfc_proveedor_factura_id ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_org_pfc_proveedor_factura_id
BEFORE INSERT OR UPDATE OF proveedor_factura_id, organization_id
ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org('proveedor_factura_id', 'proveedor_facturas');

DROP TRIGGER IF EXISTS trg_org_pfc_concepto_costo_id ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_org_pfc_concepto_costo_id
BEFORE INSERT OR UPDATE OF concepto_costo_id, organization_id
ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org('concepto_costo_id', 'conceptos_costo');

DROP TRIGGER IF EXISTS trg_org_pnc_proveedor_factura_id ON public.proveedor_notas_credito;
CREATE TRIGGER trg_org_pnc_proveedor_factura_id
BEFORE INSERT OR UPDATE OF proveedor_factura_id, organization_id
ON public.proveedor_notas_credito
FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org('proveedor_factura_id', 'proveedor_facturas');

DROP TRIGGER IF EXISTS trg_org_anticipos_proveedor_id ON public.anticipos_proveedor;
CREATE TRIGGER trg_org_anticipos_proveedor_id
BEFORE INSERT OR UPDATE OF proveedor_id, organization_id
ON public.anticipos_proveedor
FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org('proveedor_id', 'proveedores');

DROP TRIGGER IF EXISTS trg_org_anticipos_embarque_id ON public.anticipos_proveedor;
CREATE TRIGGER trg_org_anticipos_embarque_id
BEFORE INSERT OR UPDATE OF embarque_id, organization_id
ON public.anticipos_proveedor
FOR EACH ROW EXECUTE FUNCTION public._assert_padre_misma_org('embarque_id', 'embarques');

-- --------------------------------------------------------------------------
-- N7 · borrado lógico de factura emitida con pagos / NCs vivos
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_soft_delete_factura_sin_hijos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Sólo las facturas que nunca se emitieron pueden mandarse a la basura.
  IF OLD.snapshot_emision IS NULL AND OLD.estado = 'Borrador' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pagos_factura p
    WHERE p.factura_id = OLD.id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_FACTURA_DELETE_CON_PAGOS: la factura % tiene pagos registrados; elimina o cancela los pagos antes de borrarla', OLD.numero
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.factura_notas_credito nc
    WHERE nc.factura_id = OLD.id
      AND nc.deleted_at IS NULL
      AND nc.estado <> 'Cancelada'
  ) THEN
    RAISE EXCEPTION 'LC_FACTURA_DELETE_CON_NC: la factura % tiene notas de crédito vivas; cancélalas antes de borrarla', OLD.numero
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.snapshot_emision IS NOT NULL AND OLD.estado <> 'Cancelada' THEN
    RAISE EXCEPTION 'LC_FACTURA_DELETE_EMITIDA: la factura % ya fue emitida; cancélala en el SAT antes de borrarla', OLD.numero
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_soft_delete_factura_sin_hijos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_soft_delete_factura_sin_hijos() FROM anon;

DROP TRIGGER IF EXISTS trg_factura_soft_delete_guard ON public.facturas;
CREATE TRIGGER trg_factura_soft_delete_guard
BEFORE UPDATE OF deleted_at ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public._assert_soft_delete_factura_sin_hijos();

-- --------------------------------------------------------------------------
-- N15 · cancelar embarque con proformas vivas / facturas Borrador
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado = 'Cancelado'::public.estado_embarque
     AND OLD.estado NOT IN ('Cancelado'::public.estado_embarque, 'Cerrado'::public.estado_embarque)
     AND NEW.deleted_at IS NULL
     AND current_setting('app.via_rpc_estado', true) IS DISTINCT FROM '1' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.embarque_id = NEW.id
        AND f.deleted_at IS NULL
        AND f.estado IN ('Emitida', 'Vencida', 'Parcialmente pagada')
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXC: cancela o sustituye las facturas de cliente antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf
      WHERE pf.embarque_id = NEW.id
        AND pf.deleted_at IS NULL
        AND pf.estado <> 'Cancelada'
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXP: cancela las facturas de proveedor antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
    -- N15: facturas de cliente en Borrador y proformas vivas.
    IF EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.embarque_id = NEW.id
        AND f.deleted_at IS NULL
        AND f.estado = 'Borrador'
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_FACTURA_BORRADOR: elimina las facturas en borrador del embarque antes de cancelarlo'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.proformas p
      WHERE p.embarque_id = NEW.id
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_PROFORMA: cancela o elimina las proformas del embarque antes de cancelarlo'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.embarques_assert_cancelacion_sin_cxc_cxp() FROM anon;

-- N15 · borrar un embarque ya no arrastra sus proformas.
ALTER TABLE public.proformas DROP CONSTRAINT IF EXISTS proformas_embarque_id_fkey;
ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_embarque_id_fkey
  FOREIGN KEY (embarque_id) REFERENCES public.embarques(id) ON DELETE RESTRICT;
