CREATE OR REPLACE FUNCTION public._crear_embarque_replicar_conceptos(
  p_cotizacion_id uuid,
  p_embarque_id uuid,
  p_org uuid,
  p_target_ids uuid[],
  p_conceptos_venta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_costo public.cotizacion_costos%ROWTYPE;
  v_cid   uuid;
  v_venta jsonb;
  v_cant  integer;
  v_total numeric;
  v_pu    numeric;
BEGIN
  -- Idempotencia: si el embarque ya tiene conceptos vivos, no re-sembrar.
  IF EXISTS (
    SELECT 1 FROM public.conceptos_costo
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.conceptos_venta
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
  LOOP
    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' THEN
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
      VALUES (p_embarque_id, NULL, v_costo.concepto,
              COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
              CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              COALESCE(v_costo.proveedor, ''), p_org);
    ELSE
      FOREACH v_cid IN ARRAY p_target_ids LOOP
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
        VALUES (p_embarque_id, v_cid, v_costo.concepto,
                COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
                CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                COALESCE(v_costo.proveedor, ''), p_org);
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(p_conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        v_cant  := GREATEST(COALESCE((v_venta->>'cantidad')::integer, 1), 1);
        v_total := ROUND(COALESCE((v_venta->>'total')::numeric, 0), 2);
        v_pu    := COALESCE((v_venta->>'precio_unitario')::numeric, 0);

        IF ABS(v_total - ROUND(v_cant::numeric * v_pu, 2)) > 0.01 THEN
          v_pu := ROUND(v_total / v_cant::numeric, 6);
        END IF;

        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda, aplica_iva, total, organization_id
        )
        VALUES (
          p_embarque_id,
          v_venta->>'descripcion',
          v_cant,
          v_pu,
          CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, false),
          v_total,
          p_org
        );
      END IF;
    END LOOP;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;