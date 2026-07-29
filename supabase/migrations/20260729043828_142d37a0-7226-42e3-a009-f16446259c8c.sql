-- FIX C4a/C4c: totales de dinero recalculados en el servidor.

-- ============================================================
-- C4a · FACTURAS
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_factura_totales(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_n        int;
  v_subtotal numeric;
  v_iva      numeric;
  v_isr      numeric;
  v_iva_ret  numeric;
BEGIN
  SELECT
    count(*),
    COALESCE(SUM(ROUND(COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0), 2)), 0),
    COALESCE(SUM(ROUND(
        COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0)
        * COALESCE(c.tasa_iva_aplicada,
                   CASE WHEN c.tipo_iva = 'gravado_16' THEN 0.16 ELSE 0 END),
        2)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_isr, 0)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_iva, 0)), 0)
  INTO v_n, v_subtotal, v_iva, v_isr, v_iva_ret
  FROM public.conceptos_factura c
  WHERE c.factura_id = p_factura_id
    AND c.deleted_at IS NULL;

  IF v_n = 0 THEN
    -- Factura sin renglones (histórica o recién creada): solo se limpian
    -- retenciones y se cuadra el total con lo capturado.
    UPDATE public.facturas
       SET ret_isr = 0,
           ret_iva = 0,
           total = COALESCE(subtotal, 0) + COALESCE(iva, 0),
           updated_at = now()
     WHERE id = p_factura_id;
    RETURN;
  END IF;

  UPDATE public.facturas
     SET subtotal   = v_subtotal,
         iva        = v_iva,
         ret_isr    = v_isr,
         ret_iva    = v_iva_ret,
         total      = v_subtotal + v_iva - v_isr - v_iva_ret,
         updated_at = now()
   WHERE id = p_factura_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_factura_totales(uuid) IS
  'C4a: recalcula subtotal, IVA, retenciones y total de una factura desde sus conceptos vivos.';

REVOKE ALL ON FUNCTION public.recalc_factura_totales(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_factura_totales(uuid) TO authenticated, service_role;

-- Compatibilidad: el trigger trg_conceptos_factura_rollup sigue llamando esta función.
CREATE OR REPLACE FUNCTION public.recalc_factura_retenciones(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_factura_totales(p_factura_id);
END;
$$;

-- Guard anti-escritura directa de totales.
CREATE OR REPLACE FUNCTION public.guard_factura_totales_conceptos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_n        int;
  v_subtotal numeric;
  v_iva      numeric;
  v_isr      numeric;
  v_iva_ret  numeric;
BEGIN
  SELECT
    count(*),
    COALESCE(SUM(ROUND(COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0), 2)), 0),
    COALESCE(SUM(ROUND(
        COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0)
        * COALESCE(c.tasa_iva_aplicada,
                   CASE WHEN c.tipo_iva = 'gravado_16' THEN 0.16 ELSE 0 END),
        2)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_isr, 0)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_iva, 0)), 0)
  INTO v_n, v_subtotal, v_iva, v_isr, v_iva_ret
  FROM public.conceptos_factura c
  WHERE c.factura_id = NEW.id
    AND c.deleted_at IS NULL;

  IF v_n > 0 THEN
    NEW.subtotal := v_subtotal;
    NEW.iva      := v_iva;
    NEW.ret_isr  := v_isr;
    NEW.ret_iva  := v_iva_ret;
    NEW.total    := v_subtotal + v_iva - v_isr - v_iva_ret;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_factura_totales_conceptos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_factura_totales_conceptos() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_facturas_totales_guard ON public.facturas;
CREATE TRIGGER trg_facturas_totales_guard
  BEFORE UPDATE OF subtotal, iva, ret_isr, ret_iva, total
  ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_factura_totales_conceptos();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facturas_totales_consistentes') THEN
    ALTER TABLE public.facturas
      ADD CONSTRAINT facturas_totales_consistentes
      CHECK (abs(total - (subtotal + iva - COALESCE(ret_isr, 0) - COALESCE(ret_iva, 0))) <= 0.01) NOT VALID;
  END IF;
END $$;

-- Backfill de facturas no emitidas con renglones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT f.id
    FROM public.facturas f
    JOIN public.conceptos_factura c ON c.factura_id = f.id AND c.deleted_at IS NULL
    WHERE f.deleted_at IS NULL
      AND f.snapshot_emision IS NULL
  LOOP
    PERFORM public.recalc_factura_totales(r.id);
  END LOOP;
END $$;

-- ============================================================
-- C4c · CxP: proveedor_facturas.total
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_proveedor_factura_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pagado numeric;
  v_ncs    numeric;
BEGIN
  NEW.total := ROUND(
      COALESCE(NEW.subtotal, 0) + COALESCE(NEW.iva, 0)
      + COALESCE(NEW.ieps, 0) - COALESCE(NEW.retenciones, 0), 2);

  IF NEW.total < 0 THEN
    RAISE EXCEPTION 'LC_CXP_TOTAL_NEGATIVO: el total de la factura de proveedor no puede ser negativo (%)',
      NEW.total
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.total < COALESCE(OLD.total, 0) - 0.005 THEN
    SELECT COALESCE(SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)), 0)
      INTO v_pagado
    FROM public.pagos_proveedor pp
    WHERE pp.proveedor_factura_id = NEW.id
      AND pp.deleted_at IS NULL;

    SELECT COALESCE(SUM(nc.monto), 0)
      INTO v_ncs
    FROM public.proveedor_notas_credito nc
    WHERE nc.proveedor_factura_id = NEW.id
      AND nc.deleted_at IS NULL
      AND nc.estado::text = 'Aplicada';

    IF NEW.total + 0.005 < v_pagado + v_ncs THEN
      RAISE EXCEPTION 'LC_CXP_TOTAL_MENOR_PAGADO: el nuevo total % queda por debajo de lo ya pagado/aplicado %',
        ROUND(NEW.total, 2), ROUND(v_pagado + v_ncs, 2)
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_proveedor_factura_total() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_proveedor_factura_total() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_proveedor_facturas_total_guard ON public.proveedor_facturas;
CREATE TRIGGER trg_proveedor_facturas_total_guard
  BEFORE INSERT OR UPDATE OF subtotal, iva, ieps, retenciones, total
  ON public.proveedor_facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_proveedor_factura_total();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_facturas_total_nonneg') THEN
    ALTER TABLE public.proveedor_facturas
      ADD CONSTRAINT proveedor_facturas_total_nonneg CHECK (total >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_facturas_total_consistente') THEN
    ALTER TABLE public.proveedor_facturas
      ADD CONSTRAINT proveedor_facturas_total_consistente
      CHECK (abs(total - ROUND(COALESCE(subtotal,0) + COALESCE(iva,0) + COALESCE(ieps, 0) - COALESCE(retenciones,0), 2)) <= 0.01) NOT VALID;
  END IF;
END $$;