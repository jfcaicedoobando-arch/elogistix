/**
 * Tipos y select compartidos del service `proveedorFacturas`.
 * Extraído de `proveedorFacturas.helpers.ts` (límite Power-of-10 de 200 líneas).
 */
import type { Tables } from "@/integrations/supabase/types";

type ProveedorFacturaRow = Tables<"proveedor_facturas">;
export type EstadoProveedorFactura = ProveedorFacturaRow["estado"];

/** Select reutilizado por list + single fetch (evita duplicar el embed). */
export const PROVEEDOR_FACTURAS_SELECT = `
  id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor, folio_interno,
  fecha_emision, fecha_vencimiento, moneda, subtotal, iva, ieps, retenciones, total,
  estado, tipo_cambio_usd, rfc_proveedor, uuid_fiscal, dias_credito, notas,
  estado_aprobacion, motivo_rechazo, categoria_presupuesto_id,
  archivo_xml_url, archivo_pdf_url,
  uuid_verificado, uuid_verificado_fecha, uuid_estatus_sat,
  fecha_programada_pago,
  fecha_cancelacion, motivo_cancelacion, cancelada_por, created_by,
  pagos_proveedor(monto, monto_en_moneda_factura, deleted_at),
  proveedor_notas_credito(monto, estado, deleted_at),
  proveedores(origen_proveedor),
  embarques(expediente),
  presupuesto_categorias!categoria_presupuesto_id(nombre)
` as const;

/** Fila mínima de pago usada para saldar una factura de proveedor. */
export type PagoCxpParcial = {
  monto: number;
  monto_en_moneda_factura: number | null;
  deleted_at: string | null;
};
/** Fila mínima de nota de crédito de proveedor usada para saldar. */
export type NotaCreditoCxpParcial = {
  monto: number;
  estado: string;
  deleted_at: string | null;
};
export type Joined = Pick<
  ProveedorFacturaRow,
  | "id" | "proveedor_id" | "proveedor_nombre" | "embarque_id" | "folio_proveedor" | "folio_interno"
  | "fecha_emision" | "fecha_vencimiento" | "moneda" | "subtotal" | "iva" | "ieps" | "retenciones" | "total"
  | "estado" | "tipo_cambio_usd" | "rfc_proveedor" | "uuid_fiscal" | "dias_credito" | "notas"
  | "estado_aprobacion" | "motivo_rechazo" | "categoria_presupuesto_id"
  | "archivo_xml_url" | "archivo_pdf_url"
  | "uuid_verificado" | "uuid_verificado_fecha" | "uuid_estatus_sat"
  | "fecha_programada_pago"
  | "fecha_cancelacion" | "motivo_cancelacion" | "cancelada_por" | "created_by"
> & {
  pagos_proveedor: Array<PagoCxpParcial> | null;
  proveedor_notas_credito: Array<NotaCreditoCxpParcial> | null;
  proveedores: { origen_proveedor: "Nacional" | "Extranjero" | null } | null;
  embarques: { expediente: string } | null;
  presupuesto_categorias: { nombre: string } | null;
};
