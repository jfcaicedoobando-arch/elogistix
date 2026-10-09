/** Compatibilidad: los contratos pertenecen a types; la proyección SQL al servicio. */
export type { ProveedorFacturaRow, EstadoProveedorFactura, EstatusCxP, FacturaCxP, FetchCxPFiltros, PagoCxpParcial, NotaCreditoCxpParcial, Joined } from "../types/proveedorFacturas";

/** Select reutilizado por list + single fetch (evita duplicar el embed). */
export const PROVEEDOR_FACTURAS_SELECT = `
  id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor, folio_interno,
  fecha_emision, fecha_vencimiento, moneda, subtotal, iva, ieps, retenciones, total,
  estado, tipo_cambio_usd, rfc_proveedor, uuid_fiscal, dias_credito, notas,
  estado_aprobacion, motivo_rechazo, categoria_presupuesto_id,
  archivo_xml_url, archivo_pdf_url,
  uuid_verificado, uuid_verificado_fecha, uuid_estatus_sat,
  fecha_programada_pago,
  fecha_cancelacion, motivo_cancelacion, cancelada_por, created_by, updated_at,
  pagos_proveedor(monto, monto_en_moneda_factura, deleted_at),
  proveedor_notas_credito(monto, estado, deleted_at),
  proveedores(origen_proveedor),
  embarques!proveedor_facturas_embarque_id_fkey(expediente),
  presupuesto_categorias!categoria_presupuesto_id(nombre)
` as const;
