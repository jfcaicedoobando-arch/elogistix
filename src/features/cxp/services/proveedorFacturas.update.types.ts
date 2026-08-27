/** Tipos del payload de edición de facturas de proveedor. */
import type { ProveedorFacturaRow } from "./proveedorFacturas";

export interface ActualizarFacturaPayload {
  folio_proveedor: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_credito: number;
  moneda: ProveedorFacturaRow["moneda"];
  tipo_cambio_usd: number;
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  categoria_presupuesto_id: string;
  notas: string;
}

/** Subconjunto de columnas necesario para precargar el form de edición. */
export type FacturaParaEdicion = Pick<
  ProveedorFacturaRow,
  | "id" | "proveedor_id" | "proveedor_nombre" | "folio_proveedor"
  | "fecha_emision" | "fecha_vencimiento" | "dias_credito"
  | "moneda" | "tipo_cambio_usd"
  | "subtotal" | "iva" | "ieps" | "retenciones" | "total"
  | "categoria_presupuesto_id" | "notas" | "estado_aprobacion"
  // H5 (Ola 4): sello para el bloqueo optimista al guardar.
  | "updated_at"
>;
