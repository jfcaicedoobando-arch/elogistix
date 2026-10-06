-- AUD110: una captura = una factura y todos sus conceptos, en una transacción.
-- SECURITY INVOKER mantiene los mismos permisos de tabla, RLS y triggers de
-- los INSERT de la Data API. No modifica roles, políticas ni grants existentes.
-- La nueva entrada sólo se expone a authenticated; no hereda ejecución PUBLIC.
CREATE OR REPLACE FUNCTION public.crear_factura_manual_idempotente(
  p_request_id uuid, p_factura jsonb, p_conceptos jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas;
  v_id uuid;
  v_previa jsonb;
  v_hash text := md5(p_factura::text || p_conceptos::text);
BEGIN
  IF auth.uid() IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'La captura requiere una sesión y un identificador válido.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_factura FROM jsonb_populate_record(NULL::public.facturas, p_factura);
  IF v_factura.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'La captura no pertenece a la organización activa.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_conceptos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_conceptos) = 0 THEN
    RAISE EXCEPTION 'Debe haber al menos un concepto.' USING ERRCODE = '22023';
  END IF;
  v_previa := public.idempotency_claim(p_request_id, 'crear_factura_manual_idempotente');
  IF v_previa IS NOT NULL THEN
    IF v_previa->>'hash' IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'La captura ya fue enviada con otros datos. Revisa la factura guardada antes de iniciar otra captura.' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_id FROM public.facturas
      WHERE id = (v_previa->>'factura_id')::uuid AND organization_id = v_factura.organization_id
        AND deleted_at IS NULL;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'La factura de esta captura ya no está disponible.' USING ERRCODE = '42501';
    END IF;
    RETURN v_id;
  END IF;
  -- Sólo los campos de la captura original: nunca aceptar UUID/timbre/estado
  -- fiscal, ids ajenos o borrado lógico suministrados dentro del JSON.
  INSERT INTO public.facturas (
    numero, cliente_id, cliente_nombre, rfc_cliente, subtotal, iva, total,
    moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado, origen,
    serie, uso_cfdi, forma_pago, metodo_pago, dias_credito, notas, organization_id
  ) VALUES (
    v_factura.numero, v_factura.cliente_id, v_factura.cliente_nombre, v_factura.rfc_cliente,
    v_factura.subtotal, v_factura.iva, v_factura.total, v_factura.moneda,
    v_factura.tipo_cambio, v_factura.fecha_emision, v_factura.fecha_vencimiento,
    'Borrador', 'manual', v_factura.serie, v_factura.uso_cfdi,
    v_factura.forma_pago, v_factura.metodo_pago, v_factura.dias_credito,
    v_factura.notas, v_factura.organization_id
  ) RETURNING id INTO v_id;
  INSERT INTO public.conceptos_factura (
    factura_id, descripcion, cantidad, precio_unitario, total, moneda,
    clave_sat, organization_id, tipo_iva, tasa_iva_aplicada
  ) SELECT v_id, c.descripcion, c.cantidad, c.precio_unitario, c.total,
      v_factura.moneda, c.clave_sat, v_factura.organization_id, c.tipo_iva, c.tasa_iva_aplicada
    FROM jsonb_to_recordset(p_conceptos) AS c (
      descripcion text, cantidad numeric, precio_unitario numeric, total numeric,
      clave_sat text, tipo_iva text, tasa_iva_aplicada numeric
    );
  -- El rollup fiscal de conceptos sigue siendo canónico. Una falla de línea
  -- o de bitácora revierte la captura y la reclamación de idempotencia juntas.
  PERFORM public.registrar_bitacora('facturacion', 'Creó factura manual borrador',
    v_id, v_factura.numero, jsonb_build_object('cliente', v_factura.cliente_nombre,
      'total', v_factura.total, 'moneda', v_factura.moneda));
  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('factura_id', v_id, 'hash', v_hash));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_factura_manual_idempotente(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_factura_manual_idempotente(uuid, jsonb, jsonb) TO authenticated;
