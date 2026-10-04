-- Auditorías 25/54: PUE liquida deuda neta de NC con la tolerancia real de cierre.
-- Sólo cambia la validación de operaciones futuras; no modifica pagos históricos.
CREATE OR REPLACE FUNCTION public._assert_pago_pue_exhibicion_unica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_metodo text;
  v_total numeric;
  v_otros integer;
BEGIN
  SELECT f.metodo_pago, f.total INTO v_metodo, v_total
  FROM public.facturas f WHERE f.id = NEW.factura_id
  FOR UPDATE OF f;
  IF NOT FOUND OR v_metodo IS DISTINCT FROM 'PUE' THEN RETURN NEW; END IF;

  -- Canon: sólo Timbrada/Aplicada, sin soft-delete, convertidas a moneda factura.
  v_total := GREATEST(COALESCE(v_total, 0) - public._nc_aplicadas_moneda_factura(NEW.factura_id), 0);
  -- El bloqueo de factura serializa intentos; el propio pago se excluye en UPDATE.
  SELECT count(*) INTO v_otros FROM public.pagos_factura p
  WHERE p.factura_id = NEW.factura_id AND p.deleted_at IS NULL
    AND COALESCE(p.estado_rep, '') <> 'Cancelado'
    AND p.id IS DISTINCT FROM NEW.id;
  IF v_otros > 0 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_EXHIBICION_UNICA: la factura es PUE y ya tiene un pago registrado; PUE exige liquidar en una sola exhibición. Cancela el pago previo si fue un error.'
      USING ERRCODE = 'P0001';
  END IF;
  -- Mismo umbral que recalcular_estado_factura: el saldo exacto no se redondea ni se ajusta.
  IF COALESCE(NEW.monto_aplicado_factura, NEW.monto) < v_total - 0.01 THEN
    RAISE EXCEPTION 'LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL: registra el cobro por el saldo neto pendiente (%) en una sola exhibición, considerando las notas de crédito vigentes.', v_total
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._assert_pago_pue_exhibicion_unica() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_pago_pue_exhibicion_unica() TO service_role;

-- Los BEFORE se ejecutan por nombre: validar después de la conversión canónica,
-- también al editar moneda/TC, evita comparar un monto aplicado previo o enviado por el cliente.
-- Antes de zz_pago_factura_viva conserva el rechazo específico de segunda exhibición.
DROP TRIGGER IF EXISTS trg_pago_pue_exhibicion_unica ON public.pagos_factura;
DROP TRIGGER IF EXISTS z_pago_pue_exhibicion_unica ON public.pagos_factura;
CREATE TRIGGER z_pago_pue_exhibicion_unica
BEFORE INSERT OR UPDATE OF factura_id, monto, monto_aplicado_factura, moneda, tipo_cambio
ON public.pagos_factura
FOR EACH ROW EXECUTE FUNCTION public._assert_pago_pue_exhibicion_unica();
