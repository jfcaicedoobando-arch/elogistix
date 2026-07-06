
-- 1) Columnas nuevas en conceptos_factura
ALTER TABLE public.conceptos_factura
  ADD COLUMN IF NOT EXISTS tasa_ret_isr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasa_ret_iva numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_ret_isr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_ret_iva numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.conceptos_factura.tasa_ret_isr IS 'Ola 3 — Tasa ISR retenida (0.10 = 10%). 0 si no aplica.';
COMMENT ON COLUMN public.conceptos_factura.tasa_ret_iva IS 'Ola 3 — Tasa IVA retenida (0.04, 0.106667). 0 si no aplica.';

-- 2) Columnas nuevas en facturas (rollup)
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS ret_isr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ret_iva numeric NOT NULL DEFAULT 0;

-- 3) Columnas nuevas en pagos_factura (espejo proporcional)
ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS ret_isr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ret_iva numeric NOT NULL DEFAULT 0;

-- 4) Función: calcular montos por concepto antes de INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.calc_concepto_retenciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric;
BEGIN
  v_subtotal := COALESCE(NEW.cantidad, 1) * COALESCE(NEW.precio_unitario, 0);
  NEW.monto_ret_isr := ROUND(v_subtotal * COALESCE(NEW.tasa_ret_isr, 0), 2);
  NEW.monto_ret_iva := ROUND(v_subtotal * COALESCE(NEW.tasa_ret_iva, 0), 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conceptos_factura_calc_ret ON public.conceptos_factura;
CREATE TRIGGER trg_conceptos_factura_calc_ret
  BEFORE INSERT OR UPDATE ON public.conceptos_factura
  FOR EACH ROW EXECUTE FUNCTION public.calc_concepto_retenciones();

-- 5) Función: recalcular rollup en facturas
CREATE OR REPLACE FUNCTION public.recalc_factura_retenciones(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_isr numeric;
  v_iva numeric;
BEGIN
  SELECT
    COALESCE(SUM(monto_ret_isr), 0),
    COALESCE(SUM(monto_ret_iva), 0)
  INTO v_isr, v_iva
  FROM public.conceptos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  UPDATE public.facturas
    SET ret_isr = v_isr,
        ret_iva = v_iva,
        total = COALESCE(subtotal, 0) + COALESCE(iva, 0) - v_isr - v_iva,
        updated_at = now()
    WHERE id = p_factura_id;
END;
$$;

-- 6) Trigger AFTER en conceptos_factura para propagar a facturas
CREATE OR REPLACE FUNCTION public.trg_conceptos_factura_rollup()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_factura_retenciones(OLD.factura_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_factura_retenciones(NEW.factura_id);
    IF TG_OP = 'UPDATE' AND OLD.factura_id IS DISTINCT FROM NEW.factura_id THEN
      PERFORM public.recalc_factura_retenciones(OLD.factura_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_conceptos_factura_rollup ON public.conceptos_factura;
CREATE TRIGGER trg_conceptos_factura_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.conceptos_factura
  FOR EACH ROW EXECUTE FUNCTION public.trg_conceptos_factura_rollup();

-- 7) Función: calcular retenciones proporcionales en pagos_factura
CREATE OR REPLACE FUNCTION public.calc_pago_retenciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_fac_subtotal numeric;
  v_fac_iva numeric;
  v_fac_ret_isr numeric;
  v_fac_ret_iva numeric;
  v_base numeric;
  v_ratio numeric;
BEGIN
  -- Si el caller mandó retenciones explícitas (> 0), respetarlas.
  IF COALESCE(NEW.ret_isr, 0) > 0 OR COALESCE(NEW.ret_iva, 0) > 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(subtotal, 0), COALESCE(iva, 0),
         COALESCE(ret_isr, 0), COALESCE(ret_iva, 0)
    INTO v_fac_subtotal, v_fac_iva, v_fac_ret_isr, v_fac_ret_iva
  FROM public.facturas WHERE id = NEW.factura_id;

  v_base := v_fac_subtotal + v_fac_iva;
  IF v_base > 0 AND COALESCE(NEW.monto_aplicado_factura, 0) > 0 THEN
    v_ratio := NEW.monto_aplicado_factura / v_base;
    NEW.ret_isr := ROUND(v_fac_ret_isr * v_ratio, 2);
    NEW.ret_iva := ROUND(v_fac_ret_iva * v_ratio, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagos_factura_calc_ret ON public.pagos_factura;
CREATE TRIGGER trg_pagos_factura_calc_ret
  BEFORE INSERT OR UPDATE OF monto_aplicado_factura, factura_id, ret_isr, ret_iva
  ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public.calc_pago_retenciones();
