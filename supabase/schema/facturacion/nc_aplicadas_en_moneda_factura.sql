-- Fuente canónica de public.nc_aplicadas_en_moneda_factura(uuid) (Ola 1 · major release).
-- 1:1 con supabase/migrations/20260821*_ola1_candados_horas*.sql.
-- Canon único de "notas de crédito aplicadas" para los guards de cobro: la
-- misma cascada de conversión que public.saldo_factura y cartera_pendiente.
-- Si la NC no se puede convertir (falta TC) NO se resta: preferimos un saldo
-- mayor a dar por pagada una factura que no lo está.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.nc_aplicadas_en_moneda_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_moneda text;
  v_tc numeric;
  v_ncs numeric;
BEGIN
  SELECT f.moneda::text, f.tipo_cambio INTO v_moneda, v_tc
  FROM public.facturas f WHERE f.id = p_factura_id;
  IF v_moneda IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(
      CASE
        WHEN nc.moneda::text = v_moneda THEN nc.monto
        WHEN v_moneda = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
          THEN nc.monto * nc.tipo_cambio
        WHEN v_moneda <> 'MXN' AND nc.moneda::text = 'MXN' AND v_tc > 1
          THEN nc.monto / v_tc
        WHEN v_moneda <> 'MXN' AND nc.moneda::text <> 'MXN'
             AND v_moneda <> nc.moneda::text
             AND nc.tipo_cambio > 1 AND v_tc > 1
          THEN (nc.monto * nc.tipo_cambio) / v_tc
        ELSE 0
      END), 0) INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id
    AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_ncs, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;
