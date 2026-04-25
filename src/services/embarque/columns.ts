// Columnas reutilizables para queries de embarques.
// Centralizadas para evitar selecciones inconsistentes entre módulos.

export const EMBARQUE_LIST_COLUMNS =
  'id, expediente, bl_master, cliente_id, cliente_nombre, modo, estado, etd, eta, operador, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, contenedor, tipo_contenedor, descripcion_mercancia, tipo, created_at, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma' as const;

export const EMBARQUE_DETAIL_COLUMNS =
  'id, expediente, bl_master, bl_house, mawb, hawb, carta_porte, cliente_id, cliente_nombre, consignatario, shipper, modo, tipo, estado, etd, eta, fecha_creacion, fecha_llegada_real, operador, agente, naviera, aerolinea, transportista, contenedor, tipo_contenedor, tipo_servicio, tipo_carga, descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, msds_archivo, organization_id, cotizacion_id, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma, created_at, updated_at' as const;
