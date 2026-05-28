-- =========================================================
-- v12.7.0 — RPC duplicar_embarque_completo: copia contenedores hijos
-- y re-mapea contenedor_id en conceptos_venta/_costo
-- =========================================================
CREATE OR REPLACE FUNCTION public.duplicar_embarque_completo(
  p_embarque_origen_id uuid,
  p_copias jsonb,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  origen embarques%ROWTYPE;
  copia jsonb;
  nuevo_id uuid;
  creados jsonb := '[]'::jsonb;
  v_resp jsonb;
  v_mapping jsonb;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'duplicar_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT * INTO origen FROM embarques WHERE id = p_embarque_origen_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque origen no encontrado'; END IF;
  IF origen.organization_id <> current_user_org_id() AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: cross-organization access denied';
  END IF;

  FOR copia IN SELECT * FROM jsonb_array_elements(p_copias)
  LOOP
    INSERT INTO embarques (
      expediente, estado, cliente_id, cliente_nombre, modo, tipo, incoterm,
      bl_master, bl_house, naviera, puerto_origen, puerto_destino,
      aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino,
      aerolinea, transportista, agente, shipper, consignatario,
      descripcion_mercancia, tipo_carga, tipo_servicio, operador,
      mawb, hawb, carta_porte, etd, eta,
      tipo_cambio_usd, tipo_cambio_eur,
      contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas, organization_id
    ) VALUES (
      origen.expediente, 'Confirmado', origen.cliente_id, origen.cliente_nombre,
      origen.modo, origen.tipo, origen.incoterm,
      origen.bl_master, origen.bl_house, origen.naviera,
      origen.puerto_origen, origen.puerto_destino,
      origen.aeropuerto_origen, origen.aeropuerto_destino,
      origen.ciudad_origen, origen.ciudad_destino,
      origen.aerolinea, origen.transportista, origen.agente,
      origen.shipper, origen.consignatario,
      origen.descripcion_mercancia, origen.tipo_carga, origen.tipo_servicio,
      origen.operador, origen.mawb, origen.hawb, origen.carta_porte,
      origen.etd, origen.eta,
      origen.tipo_cambio_usd, origen.tipo_cambio_eur,
      NULLIF(copia->>'num_contenedor', ''), NULLIF(copia->>'tipo_contenedor', ''),
      (copia->>'peso_kg')::numeric, (copia->>'volumen_m3')::numeric, (copia->>'piezas')::int,
      origen.organization_id
    ) RETURNING id INTO nuevo_id;

    -- Copiar contenedores hijos y construir mapeo old_id -> new_id
    WITH inserted AS (
      INSERT INTO embarque_contenedores (
        embarque_id, organization_id, numero_contenedor, tipo_contenedor,
        bl_house, peso_kg, volumen_m3, piezas, orden
      )
      SELECT
        nuevo_id, origen.organization_id, numero_contenedor, tipo_contenedor,
        bl_house, peso_kg, volumen_m3, piezas, orden
      FROM embarque_contenedores
      WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL
      RETURNING id, orden
    ),
    paired AS (
      SELECT
        old.id AS old_id,
        new.id AS new_id
      FROM (
        SELECT id, orden FROM embarque_contenedores
        WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL
      ) old
      JOIN inserted new ON new.orden = old.orden
    )
    SELECT COALESCE(jsonb_object_agg(old_id::text, new_id), '{}'::jsonb)
    INTO v_mapping
    FROM paired;

    -- Conceptos de venta con re-mapeo de contenedor_id
    INSERT INTO conceptos_venta (
      embarque_id, descripcion, cantidad, precio_unitario, moneda, total,
      organization_id, contenedor_id, aplica_iva
    )
    SELECT
      nuevo_id, descripcion, cantidad, precio_unitario, moneda, total,
      origen.organization_id,
      CASE
        WHEN contenedor_id IS NOT NULL AND v_mapping ? contenedor_id::text
          THEN (v_mapping->>contenedor_id::text)::uuid
        ELSE NULL
      END,
      aplica_iva
    FROM conceptos_venta
    WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL;

    -- Conceptos de costo con re-mapeo de contenedor_id
    INSERT INTO conceptos_costo (
      embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto,
      organization_id, contenedor_id
    )
    SELECT
      nuevo_id, concepto, proveedor_nombre, proveedor_id, moneda, monto,
      origen.organization_id,
      CASE
        WHEN contenedor_id IS NOT NULL AND v_mapping ? contenedor_id::text
          THEN (v_mapping->>contenedor_id::text)::uuid
        ELSE NULL
      END
    FROM conceptos_costo
    WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL;

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
    VALUES (nuevo_id, 'Embarque duplicado desde ' || origen.expediente, 'sistema', origen.organization_id);

    creados := creados || jsonb_build_object('id', nuevo_id, 'expediente', origen.expediente);
  END LOOP;

  PERFORM public.idempotency_store(p_request_id, creados);
  RETURN creados;
END;
$function$;