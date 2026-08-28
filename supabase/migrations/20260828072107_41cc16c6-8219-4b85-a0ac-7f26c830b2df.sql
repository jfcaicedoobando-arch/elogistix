-- Ola E3 · Sub-ola C · N17: tasa 8% de frontera como régimen de primer nivel.

ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_tipo_iva_check;
ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_tipo_iva_check
  CHECK (tipo_iva = ANY (ARRAY['gravado_16'::text, 'gravado_8'::text, 'tasa_0'::text, 'exento'::text]));

ALTER TABLE public.catalogo_claves_sat
  DROP CONSTRAINT IF EXISTS catalogo_claves_sat_tipo_iva_chk;
ALTER TABLE public.catalogo_claves_sat
  ADD CONSTRAINT catalogo_claves_sat_tipo_iva_chk
  CHECK (tipo_iva = ANY (ARRAY['gravado_16'::text, 'gravado_8'::text, 'tasa_0'::text, 'exento'::text]));

CREATE OR REPLACE FUNCTION public.guard_factura_totales_conceptos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
                   CASE WHEN c.tipo_iva = 'gravado_16' THEN 0.16
                        WHEN c.tipo_iva = 'gravado_8'  THEN 0.08
                        ELSE 0 END),
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
$function$;

CREATE OR REPLACE FUNCTION public.recalc_factura_totales(p_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
                   CASE WHEN c.tipo_iva = 'gravado_16' THEN 0.16
                        WHEN c.tipo_iva = 'gravado_8'  THEN 0.08
                        ELSE 0 END),
        2)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_isr, 0)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_iva, 0)), 0)
  INTO v_n, v_subtotal, v_iva, v_isr, v_iva_ret
  FROM public.conceptos_factura c
  WHERE c.factura_id = p_factura_id
    AND c.deleted_at IS NULL;

  IF v_n = 0 THEN
    UPDATE public.facturas
       SET subtotal = 0,
           iva = 0,
           ret_isr = 0,
           ret_iva = 0,
           total = 0,
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
$function$;
