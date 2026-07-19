
-- Fase L (v13.301.83) — Multi-moneda en CxP · reintento con backfill aislado.

ALTER TABLE public.pagos_proveedor
  ADD COLUMN IF NOT EXISTS monto_en_moneda_factura numeric(18,4);

COMMENT ON COLUMN public.pagos_proveedor.monto_en_moneda_factura IS
  'Monto del pago convertido a la moneda de la factura de proveedor. Lo llena tg_pagos_proveedor_monto_convertido (Fase L, v13.301.83).';

CREATE OR REPLACE FUNCTION public.convertir_monto_pago_a_factura(
  p_monto        numeric,
  p_moneda_pago  public.moneda,
  p_tc_pago      numeric,
  p_moneda_fact  public.moneda,
  p_tc_fact      numeric
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE v_tc numeric;
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_fact THEN RETURN p_monto; END IF;

  IF (p_moneda_pago = 'MXN' AND p_moneda_fact = 'USD')
     OR (p_moneda_pago = 'USD' AND p_moneda_fact = 'MXN') THEN
    v_tc := COALESCE(NULLIF(p_tc_pago,0), NULLIF(p_tc_fact,0));
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: se requiere tipo de cambio (>0) para convertir % -> %', p_moneda_pago, p_moneda_fact
        USING ERRCODE = '22023';
    END IF;
    IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / v_tc, 4);
    ELSE                          RETURN round(p_monto * v_tc, 4);
    END IF;
  END IF;

  RAISE EXCEPTION 'LC_PAGO_CRUCE_NO_SOPORTADO: conversion % -> % no soportada. Registra el pago en la misma moneda que la factura o en su par USD/MXN.',
    p_moneda_pago, p_moneda_fact
    USING ERRCODE = '22023';
END;
$$;

REVOKE ALL ON FUNCTION public.convertir_monto_pago_a_factura(numeric, public.moneda, numeric, public.moneda, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convertir_monto_pago_a_factura(numeric, public.moneda, numeric, public.moneda, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_pagos_proveedor_monto_convertido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fact_moneda public.moneda;
  v_fact_tc     numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT moneda, tipo_cambio_usd INTO v_fact_moneda, v_fact_tc
    FROM public.proveedor_facturas WHERE id = NEW.proveedor_factura_id;
  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROV_NO_ENCONTRADA: factura % no existe', NEW.proveedor_factura_id
      USING ERRCODE = 'P0002';
  END IF;
  NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
    NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagos_proveedor_monto_convertido ON public.pagos_proveedor;
CREATE TRIGGER trg_pagos_proveedor_monto_convertido
  BEFORE INSERT OR UPDATE OF monto, moneda, tipo_cambio_usd, proveedor_factura_id
  ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.tg_pagos_proveedor_monto_convertido();

-- Backfill aislando triggers AFTER de recálculo (no queremos remover estado
-- de liquidación de embarques cerrados, ni tocar la fecha de pago).
DO $$
BEGIN
  -- Desactivar SOLO los triggers de recálculo que no aplican al backfill.
  EXECUTE 'ALTER TABLE public.pagos_proveedor DISABLE TRIGGER USER';
  -- Reactivamos el nuevo trigger BEFORE para que el UPDATE lo dispare
  -- y calcule la columna (equivalente a hacerlo a mano vía función).
  EXECUTE 'ALTER TABLE public.pagos_proveedor ENABLE TRIGGER trg_pagos_proveedor_monto_convertido';

  UPDATE public.pagos_proveedor pp
     SET monto_en_moneda_factura = public.convertir_monto_pago_a_factura(
       pp.monto, pp.moneda, pp.tipo_cambio_usd, pf.moneda, pf.tipo_cambio_usd
     )
    FROM public.proveedor_facturas pf
   WHERE pf.id = pp.proveedor_factura_id
     AND pp.monto_en_moneda_factura IS NULL;

  EXECUTE 'ALTER TABLE public.pagos_proveedor ENABLE TRIGGER USER';
END $$;

ALTER TABLE public.pagos_proveedor
  DROP CONSTRAINT IF EXISTS pagos_proveedor_monto_convertido_no_null;
ALTER TABLE public.pagos_proveedor
  ADD CONSTRAINT pagos_proveedor_monto_convertido_no_null
  CHECK (deleted_at IS NOT NULL OR monto_en_moneda_factura IS NOT NULL) NOT VALID;
ALTER TABLE public.pagos_proveedor
  VALIDATE CONSTRAINT pagos_proveedor_monto_convertido_no_null;

CREATE OR REPLACE VIEW public.v_proveedor_facturas_saldo
WITH (security_invoker = true) AS
SELECT
  pf.id AS proveedor_factura_id,
  pf.organization_id,
  pf.total,
  COALESCE((SELECT SUM(pp.monto_en_moneda_factura) FROM public.pagos_proveedor pp
             WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0) AS pagado,
  COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
             WHERE nc.proveedor_factura_id = pf.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL), 0) AS notas_credito_aplicadas,
  (
    pf.total
    - COALESCE((SELECT SUM(pp.monto_en_moneda_factura) FROM public.pagos_proveedor pp
                 WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
                 WHERE nc.proveedor_factura_id = pf.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL), 0)
  ) AS saldo
FROM public.proveedor_facturas pf
WHERE pf.deleted_at IS NULL;

GRANT SELECT ON public.v_proveedor_facturas_saldo TO authenticated;
GRANT SELECT ON public.v_proveedor_facturas_saldo TO service_role;

CREATE OR REPLACE FUNCTION public.check_no_sobrepago_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total      numeric;
  v_pagado     numeric;
  v_ncs        numeric;
  v_nuevo_conv numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT total INTO v_total FROM public.proveedor_facturas
   WHERE id = NEW.proveedor_factura_id AND deleted_at IS NULL;
  IF v_total IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(monto_en_moneda_factura), 0) INTO v_pagado
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND id IS DISTINCT FROM NEW.id;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
    FROM public.proveedor_notas_credito
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND estado = 'Aplicada'::public.estado_nota_credito_proveedor
     AND deleted_at IS NULL;

  v_nuevo_conv := COALESCE(NEW.monto_en_moneda_factura, 0);
  IF v_pagado + v_nuevo_conv + v_ncs > v_total + 0.01 THEN
    RAISE EXCEPTION
      'SOBREPAGO_PROVEEDOR: el pago (% en moneda-factura) excede el saldo. Total: %, ya pagado: %, notas de credito: %.',
      v_nuevo_conv, v_total, v_pagado, v_ncs
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_sobrepago ON public.pagos_proveedor;
CREATE TRIGGER trg_check_no_sobrepago
  BEFORE INSERT OR UPDATE OF monto, moneda, tipo_cambio_usd, deleted_at
  ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.check_no_sobrepago_proveedor();
