-- Auditoría 23: una aplicación consume un anticipo, no genera otra salida.
-- Sólo lectura e invoker: valida el vínculo completo antes de reutilizar el
-- cargo original. Un vínculo inconsistente exige revisión, nunca otro cargo.
CREATE OR REPLACE FUNCTION public._movimiento_original_anticipo_aplicado(p_pago_id uuid) RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_mov public.bbva_movimientos;
  v_org uuid;
  v_cantidad integer;
BEGIN
  SELECT * INTO v_pago FROM public.pagos_proveedor
  WHERE id = p_pago_id AND deleted_at IS NULL;
  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_APLICACION_INCONSISTENTE: el pago no existe o fue eliminado'
      USING ERRCODE = '23514';
  END IF;
  IF auth.uid() IS NOT NULL OR auth.role() = 'authenticated' THEN
    v_org := public.org_scope();
    IF v_org IS NULL OR v_org IS DISTINCT FROM v_pago.organization_id THEN
      RAISE EXCEPTION 'LC_ORG_MISMATCH: el pago no pertenece a la organización activa'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT count(*) INTO v_cantidad FROM public.anticipos_aplicaciones
  WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL;
  IF NOT v_pago.es_anticipo_aplicado OR v_cantidad <> 1 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_APLICACION_INCONSISTENTE: se requiere una sola aplicación vigente vinculada al pago; revisa el anticipo'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_ap FROM public.anticipos_aplicaciones
  WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL;
  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = v_ap.anticipo_id;
  SELECT * INTO v_fact FROM public.proveedor_facturas WHERE id = v_pago.proveedor_factura_id;
  IF v_ant.id IS NULL OR v_ant.deleted_at IS NOT NULL OR v_ant.estado = 'cancelado'
     OR v_fact.id IS NULL OR v_fact.deleted_at IS NOT NULL OR v_fact.estado = 'Cancelada'
     OR v_ap.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_ant.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_fact.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_ap.proveedor_factura_id IS DISTINCT FROM v_pago.proveedor_factura_id
     OR v_fact.proveedor_id IS DISTINCT FROM v_ant.proveedor_id
     OR v_ap.monto_aplicado IS DISTINCT FROM v_pago.monto
     OR v_ap.moneda_aplicada IS DISTINCT FROM v_pago.moneda
     OR v_ant.moneda IS DISTINCT FROM v_pago.moneda
     OR v_ap.fecha_aplicacion IS DISTINCT FROM v_pago.fecha_pago
     OR v_ant.cuenta_bancaria_id IS DISTINCT FROM v_pago.cuenta_bancaria_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_APLICACION_INCONSISTENTE: la aplicación no coincide con el pago, la factura o el anticipo original; revisa el vínculo antes de continuar'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bbva_movimientos
             WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: existe un movimiento adicional vinculado a la aplicación; revisa tesorería sin regenerar otro cargo'
      USING ERRCODE = '23514';
  END IF;
  IF v_ant.cuenta_bancaria_id IS NULL THEN
    IF COALESCE(v_ant.metodo_pago, '') <> 'Efectivo'
       OR EXISTS (SELECT 1 FROM public.bbva_movimientos
                  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: el anticipo sin cuenta no tiene un origen en efectivo consistente'
        USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_cantidad FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL
    AND cargo > 0 AND COALESCE(abono, 0) = 0;
  IF v_cantidad <> 1 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: falta el cargo original del anticipo o hay más de uno; revisa tesorería sin generar otro cargo'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_mov FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL
    AND cargo > 0 AND COALESCE(abono, 0) = 0;
  IF v_mov.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_mov.cuenta_bancaria_id IS DISTINCT FROM v_ant.cuenta_bancaria_id
     OR abs(v_mov.cargo - v_ant.monto) > 0.01
     OR v_mov.pago_proveedor_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: el cargo original no coincide con el anticipo; revisa cuenta, organización e importe'
      USING ERRCODE = '23514';
  END IF;
  RETURN v_mov.id;
END;
$function$;

REVOKE ALL ON FUNCTION public._movimiento_original_anticipo_aplicado(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._movimiento_original_anticipo_aplicado(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._movimiento_original_anticipo_aplicado(uuid) TO authenticated, service_role;
