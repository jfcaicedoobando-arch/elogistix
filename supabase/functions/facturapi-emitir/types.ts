/**
 * Tipos compartidos entre `index.ts`, `emitir.ts` y `contexto.ts`.
 * Viven aparte para evitar ciclos de import entre módulos.
 */
export interface FacturaRow {
  id: string;
  numero?: string | null;
  serie?: string | null;
  estado?: string | null;
  moneda?: string | null;
  fecha_emision?: string | null;

  tipo_cambio?: number | string | null;
  uso_cfdi?: string | null;
  forma_pago?: string | null;
  metodo_pago?: string | null;
  cliente_id: string;
  rfc_cliente?: string | null;
  organization_id: string;
  facturapi_id?: string | null;
  sustituye_a?: string | null;
  embarque_id?: string | null;
  expediente?: string | null;
  referencia_bl?: string | null;
  subtotal?: number | string | null;
  /** P1 · Auditoría fiscal — IVA trasladado guardado; se coteja antes del PAC. */
  iva?: number | string | null;
  total?: number | string | null;
}

/**
 * Columnas de `facturas` que alimentan a `FacturaRow`. Vive aquí para que la
 * carga inicial (`loadFactura`) y el realineo de fecha (`fechaEmision.ts`)
 * devuelvan EXACTAMENTE la misma forma de fila.
 */
export const FACTURA_COLUMNS =
  "id, numero, serie, estado, moneda, fecha_emision, tipo_cambio, uso_cfdi, forma_pago, metodo_pago, cliente_id, rfc_cliente, organization_id, facturapi_id, sustituye_a, embarque_id, expediente, referencia_bl, subtotal, iva, total";

export interface Claim { claimTag: string; claimAt: string; release: () => Promise<void> }

export interface UserIdentity { id: string; email?: string | null }
