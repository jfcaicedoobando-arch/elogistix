// Columnas reutilizables para queries del portal de clientes.

export const PORTAL_EMBARQUE_LIST_COLUMNS =
  'id, expediente, cliente_nombre, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, tipo_servicio, naviera, aerolinea, transportista, contenedor, tipo_contenedor, created_at' as const;

export const PORTAL_EMBARQUE_DETAIL_COLUMNS =
  'id, expediente, bl_master, bl_house, mawb, hawb, cliente_id, cliente_nombre, consignatario, shipper, modo, tipo, estado, etd, eta, fecha_creacion, fecha_llegada_real, naviera, aerolinea, transportista, contenedor, tipo_contenedor, tipo_servicio, tipo_carga, descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, organization_id, created_at, updated_at' as const;

// v13.301.90 (Fase Q.1): eliminados `deleted_at, deleted_by` — el portal no debe
// exponer IDs UUID de staff interno ni metadatos de borrado suave. Las queries
// filtran `deleted_at IS NULL` para ocultar registros eliminados.
export const PORTAL_EVENTO_COLUMNS =
  'id, embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id, created_at' as const;

export const PORTAL_DOCUMENTO_COLUMNS =
  'id, embarque_id, nombre, archivo, estado, notas, organization_id, created_at' as const;

export const PORTAL_COTIZACION_LIST_COLUMNS =
  'id, folio, cliente_nombre, modo, tipo, estado, moneda, subtotal, origen, destino, created_at, fecha_vigencia, fecha_aceptacion, fecha_rechazo, embarque_id' as const;

// v13.301.90 (Fase Q.1): whitelist para el detalle de cotización. Reemplaza
// el `select("*")` previo que filtraba 81 columnas incluyendo campos internos
// (`tarifa_id`, `tarifa_override`, `sin_desglose_costos`, `oportunidad_id`,
// `prospecto_*`, `deleted_by`, `revalidacion_*`, etc.). Sólo se listan campos
// consumidos por la UI del portal.
export const PORTAL_COTIZACION_DETAIL_COLUMNS =
  'id, folio, cliente_id, cliente_nombre, modo, tipo, tipo_embarque, tipo_contenedor, tipo_peso, tipo_carga, sector_economico, estado, moneda, subtotal, incoterm, origen, destino, ruta_texto, frecuencia, tiempo_transito_dias, punto_intermedio, descripcion_mercancia, descripcion_adicional, peso_kg, volumen_m3, piezas, msds_archivo, dimensiones_lcl, dimensiones_aereas, conceptos_venta, notas, comentario_cliente, seguro, valor_seguro_usd, carta_garantia, num_contenedores, modalidad_equipo, dias_almacenaje, dias_libres_destino, tipo_unidad, tipo_movimiento, tipo_documento, fecha_envio, fecha_aceptacion, fecha_rechazo, fecha_vigencia, embarque_id, created_at, updated_at' as const;

export const PORTAL_FACTURA_LIST_COLUMNS =
  'id, numero, expediente, cliente_nombre, estado, moneda, subtotal, iva, total, fecha_emision, fecha_vencimiento' as const;

export const PORTAL_FACTURA_DETAIL_COLUMNS =
  'id, numero, expediente, cliente_id, cliente_nombre, estado, moneda, subtotal, iva, total, tipo_cambio, fecha_emision, fecha_vencimiento, referencia_bl, notas, embarque_id, factura_pdf_url, factura_xml_url, snapshot_emision' as const;

export const PORTAL_PAGO_FACTURA_COLUMNS =
  'id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago, referencia, rep_uuid, rep_pdf_url, rep_xml_url' as const;
