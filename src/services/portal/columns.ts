// Columnas reutilizables para queries del portal de clientes.

export const PORTAL_EMBARQUE_LIST_COLUMNS =
  'id, expediente, cliente_nombre, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, tipo_servicio, naviera, aerolinea, transportista, contenedor, tipo_contenedor, created_at' as const;

export const PORTAL_EMBARQUE_DETAIL_COLUMNS =
  'id, expediente, bl_master, bl_house, mawb, hawb, cliente_id, cliente_nombre, consignatario, shipper, modo, tipo, estado, etd, eta, fecha_creacion, fecha_llegada_real, naviera, aerolinea, transportista, contenedor, tipo_contenedor, tipo_servicio, tipo_carga, descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, organization_id, created_at, updated_at' as const;

export const PORTAL_EVENTO_COLUMNS =
  'id, embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id, created_at' as const;

export const PORTAL_DOCUMENTO_COLUMNS =
  'id, embarque_id, nombre, archivo, estado, notas, organization_id, created_at' as const;

export const PORTAL_COTIZACION_LIST_COLUMNS =
  'id, folio, cliente_nombre, modo, tipo, estado, moneda, subtotal, origen, destino, created_at, fecha_vigencia' as const;

export const PORTAL_FACTURA_LIST_COLUMNS =
  'id, numero, expediente, cliente_nombre, estado, moneda, subtotal, iva, total, fecha_emision, fecha_vencimiento' as const;
