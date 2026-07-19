-- Fase N (v13.301.85) — Recálculo automático estado factura proveedor

CREATE OR REPLACE FUNCTION public._recalc_estado_proveedor_factura(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_saldo  numeric;
  v_nuevo  text;
BEGIN
  SELECT estado::text INTO v_estado
  FROM public.proveedor_facturas
  WHERE id = p_factura_id;

  IF v_estado IS NULL THEN RETURN; END IF;
  IF v_estado IN ('Cancelada','Borrador') THEN RETURN; END IF;

  SELECT COALESCE(saldo, 0) INTO v_saldo
  FROM public.v_proveedor_facturas_saldo
  WHERE proveedor_factura_id = p_factura_id;

  IF v_saldo IS NULL THEN v_saldo := 0; END IF;

  IF v_saldo <= 0.01 THEN v_nuevo := 'Pagada'; ELSE v_nuevo := 'Vigente'; END IF;

  IF v_nuevo IS DISTINCT FROM v_estado THEN
    UPDATE public.proveedor_facturas
       SET estado = v_nuevo::estado_proveedor_factura,
           updated_at = now()
     WHERE id = p_factura_id
       AND estado::text IS DISTINCT FROM v_nuevo;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_recalcular_estado_factura_proveedor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_factura_id := OLD.proveedor_factura_id;
  ELSE
    v_factura_id := NEW.proveedor_factura_id;
    IF TG_OP = 'UPDATE' AND OLD.proveedor_factura_id IS DISTINCT FROM NEW.proveedor_factura_id THEN
      PERFORM public._recalc_estado_proveedor_factura(OLD.proveedor_factura_id);
    END IF;
  END IF;

  IF v_factura_id IS NOT NULL THEN
    PERFORM public._recalc_estado_proveedor_factura(v_factura_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.tg_recalcular_estado_factura_proveedor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._recalc_estado_proveedor_factura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._recalc_estado_proveedor_factura(uuid) TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_pagos_proveedor_recalcular_estado ON public.pagos_proveedor;
CREATE TRIGGER trg_pagos_proveedor_recalcular_estado
AFTER INSERT OR UPDATE OR DELETE ON public.pagos_proveedor
FOR EACH ROW EXECUTE FUNCTION public.tg_recalcular_estado_factura_proveedor();

DROP TRIGGER IF EXISTS trg_notas_credito_prov_recalcular_estado ON public.proveedor_notas_credito;
CREATE TRIGGER trg_notas_credito_prov_recalcular_estado
AFTER INSERT OR UPDATE OR DELETE ON public.proveedor_notas_credito
FOR EACH ROW EXECUTE FUNCTION public.tg_recalcular_estado_factura_proveedor();

-- Backfill defensivo: sólo Vigente → Pagada
UPDATE public.proveedor_facturas pf
   SET estado = 'Pagada'::estado_proveedor_factura,
       updated_at = now()
  FROM public.v_proveedor_facturas_saldo v
 WHERE v.proveedor_factura_id = pf.id
   AND pf.estado = 'Vigente'::estado_proveedor_factura
   AND COALESCE(v.saldo, 0) <= 0.01;
