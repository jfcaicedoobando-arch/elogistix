-- Fuente canónica de public.duplicar_cotizacion (v13.823.351).
--
-- Antes copiaba un conjunto antiguo de columnas (el de la primera versión del
-- módulo) y perdía prospecto, tipo de carga/embarque/contenedor, dimensiones,
-- seguro, carta garantía, días libres, tarifa vinculada, tipo de cambio, agente
-- y naviera; los costos se copiaban sin `costeo_tarifa_id` /
-- `costeo_tarifa_recargo_id`, así que la copia no podía revalidarse ni
-- convertirse a embarque. Tampoco filtraba `deleted_at`, de modo que una
-- llamada directa podía duplicar una cotización eliminada.
--
-- Contrato de la copia: se replican TODOS los campos funcionales y sólo se
-- reinician identidad (id/folio), ciclo de vida (estado, embarque, fechas,
-- versión, revalidación) y autoría.

CREATE OR REPLACE FUNCTION public.duplicar_cotizacion(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_deleted timestamptz;
  v_nueva_id uuid := gen_random_uuid();
  v_folio text;
BEGIN
  SELECT organization_id, deleted_at INTO v_org, v_deleted
    FROM public.cotizaciones WHERE id = p_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_ELIMINADA: no se puede duplicar una cotización eliminada'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_org IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'No pertenece a tu organización' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'ejecutivo_pricing')) THEN
    RAISE EXCEPTION 'Rol insuficiente para duplicar cotizaciones' USING ERRCODE = '42501';
  END IF;

  v_folio := public.siguiente_folio_cotizacion();

  INSERT INTO public.cotizaciones (
    id, folio, organization_id, duplicada_de_id,
    cliente_id, cliente_nombre, es_prospecto,
    prospecto_empresa, prospecto_contacto, prospecto_email, prospecto_telefono,
    oportunidad_id,
    modo, tipo, incoterm, tipo_movimiento, tipo_documento,
    descripcion_mercancia, descripcion_adicional, sector_economico, comentario_cliente,
    peso_kg, volumen_m3, piezas, tipo_peso,
    tipo_carga, msds_archivo, tipo_embarque, tipo_contenedor, num_contenedores,
    tipo_unidad, modalidad_equipo,
    dimensiones_lcl, dimensiones_aereas,
    origen, destino, punto_intermedio, ruta_texto,
    tiempo_transito_dias, frecuencia,
    seguro, valor_seguro_usd, carta_garantia,
    dias_libres_destino, dias_almacenaje,
    lcl_tarifa_wm, lcl_minimo_flete, lcl_dias_libres_almacenaje, lcl_consolidador_id,
    agente_id, naviera_id,
    tarifa_id, tarifa_override, tarifas_informativas,
    tipo_cambio_usd, sin_desglose_costos,
    conceptos_venta, subtotal, moneda, notas, operador,
    vigencia_dias, estado, version, estado_revalidacion, created_by
  )
  SELECT
    v_nueva_id, v_folio, v_org, p_id,
    cliente_id, cliente_nombre, es_prospecto,
    prospecto_empresa, prospecto_contacto, prospecto_email, prospecto_telefono,
    oportunidad_id,
    modo, tipo, incoterm, tipo_movimiento, tipo_documento,
    descripcion_mercancia, descripcion_adicional, sector_economico, comentario_cliente,
    peso_kg, volumen_m3, piezas, tipo_peso,
    tipo_carga, msds_archivo, tipo_embarque, tipo_contenedor, num_contenedores,
    tipo_unidad, modalidad_equipo,
    dimensiones_lcl, dimensiones_aereas,
    origen, destino, punto_intermedio, ruta_texto,
    tiempo_transito_dias, frecuencia,
    seguro, valor_seguro_usd, carta_garantia,
    dias_libres_destino, dias_almacenaje,
    lcl_tarifa_wm, lcl_minimo_flete, lcl_dias_libres_almacenaje, lcl_consolidador_id,
    agente_id, naviera_id,
    tarifa_id, tarifa_override, tarifas_informativas,
    tipo_cambio_usd, sin_desglose_costos,
    conceptos_venta, subtotal, moneda, notas, operador,
    vigencia_dias,
    -- Ciclo de vida reiniciado: la copia nace como borrador v1 sin embarque,
    -- sin fechas de envío/aceptación y sin revalidación heredada.
    'Borrador'::estado_cotizacion, 1, 'ninguna', auth.uid()
  FROM public.cotizaciones
  WHERE id = p_id;

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, proveedor, unidad_medida,
     cantidad, costo_unitario, precio_venta, notas,
     costeo_tarifa_id, costeo_tarifa_recargo_id)
  SELECT v_nueva_id, v_org, concepto, moneda, proveedor, unidad_medida,
         cantidad, costo_unitario, precio_venta, notas,
         costeo_tarifa_id, costeo_tarifa_recargo_id
    FROM public.cotizacion_costos
   WHERE cotizacion_id = p_id
     AND deleted_at IS NULL;

  RETURN v_nueva_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicar_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_cotizacion(uuid) TO authenticated, service_role;
