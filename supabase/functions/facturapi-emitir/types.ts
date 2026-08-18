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
  total?: number | string | null;
}

export interface Claim { claimTag: string; claimAt: string; release: () => Promise<void> }

export interface UserIdentity { id: string; email?: string | null }
