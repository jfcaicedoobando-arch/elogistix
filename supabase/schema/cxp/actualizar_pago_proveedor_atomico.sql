-- Fuente canónica de public.actualizar_pago_proveedor_atomico(...).
-- D5 (v13.823.382): edición de pago CxP transaccional. Bloquea pago y factura,
-- valida rol/tenant/concurrencia, actualiza el pago y reemplaza SÓLO el
-- movimiento bancario derivado del sistema en la misma transacción; las líneas
-- importadas del estado de cuenta se desvinculan, nunca se borran.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.actualizar_pago_proveedor_atomico(
  p_pago_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_moneda text,
  p_tipo_cambio_usd numeric,
  p_metodo_pago text,
  p_referencia text DEFAULT ''::text,
  p_cuenta_bancaria_id uuid DEFAULT NULL,
  p_notas text DEFAULT ''::text,
  p_diferencia_cambiaria_mxn numeric DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pago public.pagos_proveedor;
  v_org uuid;
  v_mov_id uuid;
BEGIN
  -- D5: todo en UNA transacción (pago + movimiento espejo). Antes eran tres
  -- llamadas del navegador y un fallo dejaba la factura editada sin salida
  -- bancaria (o con la salida vieja).
  SELECT * INTO v_pago FROM public.pagos_proveedor
   WHERE id = p_pago_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el pago ya no existe o fue eliminado'
      USING ERRCODE = 'P0002';
  END IF;

  v_org := public.org_scope();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: no hay organización activa para validar el pago'
      USING ERRCODE = '42501';
  END IF;
  IF v_pago.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_ORG_MISMATCH: el pago pertenece a otra organización'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_any_role(auth.uid(),
        ARRAY['tesorero','contador','admin','admin_org','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO: se requiere permiso de tesorería para editar el pago'
      USING ERRCODE = '42501';
  END IF;

  -- Bloqueo de la factura: el guard recalcula el saldo con ella tomada.
  PERFORM 1 FROM public.proveedor_facturas
   WHERE id = v_pago.proveedor_factura_id FOR UPDATE;

  IF p_expected_updated_at IS NOT NULL
     AND v_pago.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: otro usuario editó este pago; recarga antes de guardar'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.pagos_proveedor SET
    fecha_pago = p_fecha_pago,
    monto = p_monto,
    moneda = p_moneda::moneda,
    tipo_cambio_usd = NULLIF(COALESCE(p_tipo_cambio_usd, 0), 0),
    metodo_pago = p_metodo_pago,
    referencia = COALESCE(p_referencia, ''),
    cuenta_bancaria_id = p_cuenta_bancaria_id,
    notas = COALESCE(p_notas, ''),
    diferencia_cambiaria_mxn = p_diferencia_cambiaria_mxn
  WHERE id = p_pago_id;

  -- Reemplazo del movimiento: sólo la línea DERIVADA del sistema se da de baja.
  -- Una línea importada del estado de cuenta jamás se borra: se desvincula.
  UPDATE public.bbva_movimientos
     SET pago_proveedor_id = NULL
   WHERE pago_proveedor_id = p_pago_id
     AND deleted_at IS NULL
     AND COALESCE(origen::text, '') <> 'sistema';

  UPDATE public.bbva_movimientos
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE deleted_at IS NULL
     AND COALESCE(origen::text, '') = 'sistema'
     AND (pago_proveedor_id = p_pago_id OR hash_dedupe = 'pago-' || p_pago_id::text);

  IF p_cuenta_bancaria_id IS NOT NULL THEN
    v_mov_id := public._asegurar_movimiento_pago_proveedor(p_pago_id);
    IF v_mov_id IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_NO_CREADO: no se pudo regenerar la salida bancaria del pago'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN jsonb_build_object('pago_id', p_pago_id, 'movimiento_id', v_mov_id,
                            'movimiento_creado', v_mov_id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_pago_proveedor_atomico(uuid, date, numeric, text, numeric, text, text, uuid, text, numeric, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_pago_proveedor_atomico(uuid, date, numeric, text, numeric, text, text, uuid, text, numeric, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_pago_proveedor_atomico(uuid, date, numeric, text, numeric, text, text, uuid, text, numeric, timestamptz) TO authenticated, service_role;