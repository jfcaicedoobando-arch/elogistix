CREATE OR REPLACE FUNCTION public.monto_pago_en_moneda_factura(p_monto numeric, p_moneda_pago text, p_tc_pago numeric, p_moneda_factura text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_factura THEN RETURN p_monto; END IF;
  IF COALESCE(p_tc_pago, 0) <= 0 THEN RETURN NULL; END IF;
  IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / p_tc_pago, 4); END IF;
  IF p_moneda_factura = 'MXN' THEN RETURN round(p_monto * p_tc_pago, 4); END IF;
  -- Cruce USD<->EUR: pagos_proveedor no almacena TC cruzado; se excluye.
  RETURN NULL;
END;
$function$;


CREATE OR REPLACE FUNCTION public.monto_pago_proveedor_en_moneda_factura(p_es_anticipo_aplicado boolean, p_monto_en_moneda_factura numeric, p_monto numeric, p_moneda_pago text, p_tc_pago numeric, p_moneda_factura text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN p_es_anticipo_aplicado THEN p_monto_en_moneda_factura
    ELSE public.monto_pago_en_moneda_factura(
      p_monto, p_moneda_pago, p_tc_pago, p_moneda_factura)
  END;
$function$;


CREATE OR REPLACE VIEW public.v_proveedor_facturas_saldo AS
 SELECT id AS proveedor_factura_id,
    organization_id,
    total,
    COALESCE(( SELECT sum(pp.monto_en_moneda_factura) AS sum
           FROM pagos_proveedor pp
          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0::numeric) AS pagado,
    COALESCE(( SELECT sum(monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, pf.moneda::text)) AS sum
           FROM proveedor_notas_credito nc
          WHERE nc.proveedor_factura_id = pf.id AND nc.estado = 'Aplicada'::estado_nota_credito_proveedor AND nc.deleted_at IS NULL), 0::numeric) AS notas_credito_aplicadas,
    total - COALESCE(( SELECT sum(pp.monto_en_moneda_factura) AS sum
           FROM pagos_proveedor pp
          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0::numeric) - COALESCE(( SELECT sum(monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, pf.moneda::text)) AS sum
           FROM proveedor_notas_credito nc
          WHERE nc.proveedor_factura_id = pf.id AND nc.estado = 'Aplicada'::estado_nota_credito_proveedor AND nc.deleted_at IS NULL), 0::numeric) AS saldo
   FROM proveedor_facturas pf
  WHERE deleted_at IS NULL;

