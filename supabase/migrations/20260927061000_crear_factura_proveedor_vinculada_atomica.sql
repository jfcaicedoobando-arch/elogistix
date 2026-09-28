-- R2-F01: la captura de una factura con costos vinculados debe ser atómica.
-- El trigger tg_pfc_validar_vinculo_costo conserva la autoridad del tope,
-- moneda, proveedor y organización; cualquier error revierte también la factura.
CREATE OR REPLACE FUNCTION public.crear_factura_proveedor_vinculada_rpc(
  p_factura jsonb,
  p_lineas jsonb
) RETURNS public.proveedor_facturas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_factura public.proveedor_facturas;
  v_linea jsonb;
BEGIN
  IF jsonb_typeof(p_factura) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_lineas) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lineas) = 0 THEN
    RAISE EXCEPTION 'LC_CXP_CAPTURA_VINCULADA_INVALIDA: faltan datos de factura o vínculos'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.proveedor_facturas (
    proveedor_id, proveedor_nombre, folio_proveedor, fecha_emision,
    fecha_vencimiento, dias_credito, moneda, tipo_cambio_usd,
    subtotal, iva, ieps, retenciones, total, estado, notas,
    categoria_presupuesto_id, created_by, uuid_fiscal, rfc_proveedor,
    embarque_id, origen_carga
  ) VALUES (
    (p_factura->>'proveedor_id')::uuid,
    p_factura->>'proveedor_nombre',
    p_factura->>'folio_proveedor',
    (p_factura->>'fecha_emision')::date,
    NULLIF(p_factura->>'fecha_vencimiento', '')::date,
    (p_factura->>'dias_credito')::integer,
    (p_factura->>'moneda')::public.moneda,
    (p_factura->>'tipo_cambio_usd')::numeric,
    (p_factura->>'subtotal')::numeric,
    (p_factura->>'iva')::numeric,
    (p_factura->>'ieps')::numeric,
    (p_factura->>'retenciones')::numeric,
    (p_factura->>'total')::numeric,
    (p_factura->>'estado')::public.estado_proveedor_factura,
    p_factura->>'notas',
    (p_factura->>'categoria_presupuesto_id')::uuid,
    NULLIF(p_factura->>'created_by', '')::uuid,
    p_factura->>'uuid_fiscal',
    p_factura->>'rfc_proveedor',
    NULLIF(p_factura->>'embarque_id', '')::uuid,
    p_factura->>'origen_carga'
  ) RETURNING * INTO v_factura;

  FOR v_linea IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    IF NULLIF(v_linea->>'concepto_costo_id', '') IS NULL
       OR COALESCE((v_linea->>'monto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_CXP_CAPTURA_VINCULADA_INVALIDA: cada vínculo requiere costo e importe positivo'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.proveedor_facturas_conceptos (
      organization_id, proveedor_factura_id, concepto_costo_id,
      descripcion, cantidad, monto
    ) VALUES (
      v_factura.organization_id, v_factura.id,
      (v_linea->>'concepto_costo_id')::uuid,
      COALESCE(v_linea->>'descripcion', ''), 1,
      (v_linea->>'monto')::numeric
    );
  END LOOP;

  RETURN v_factura;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_factura_proveedor_vinculada_rpc(jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_factura_proveedor_vinculada_rpc(jsonb, jsonb)
  TO authenticated, service_role;
