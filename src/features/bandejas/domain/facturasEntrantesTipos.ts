/**
 * Tipos de fila del Buzón de facturas de proveedor.
 *
 * v13.746.2 — Extraído de `facturasEntrantesBuzon.ts` (límite de 200 líneas).
 */
export type TonoAntiguedad = "neutral" | "info" | "warning" | "destructive";

export interface FilaBuzon {
  nombre_archivo: string;
  nota?: string | null;
  folio_serie?: string | null;
  created_at: string;
  archivo_path?: string | null;
  xml_path?: string | null;
  /** v13.398.0 — Importe leído del CFDI/PDF; sin él no se puede priorizar la captura. */
  total_detectado?: number | null;
  /** v13.744.0 — Subtotal del CFDI (sin IVA): es la cifra que muestra el buzón. */
  subtotal_detectado?: number | null;
  moneda_detectada?: string | null;
  /** v13.618.0 — Importe que capturó operaciones al subir (documentos sin XML). */
  monto_declarado?: number | null;
  moneda_declarada?: string | null;
  /** v13.619.0 — `operador`: correo del dueño del embarque. */
  embarques?: { expediente: string | null; operador?: string | null } | null;
  proveedores?: { nombre: string | null; origen_proveedor?: string | null } | null;
}
