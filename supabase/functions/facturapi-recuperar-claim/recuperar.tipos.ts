/** Tipos y constantes compartidas de la recuperación de claims. */
export const MIN_EDAD_MINUTOS = 3;

export interface UserIdentity { id: string; email?: string | null }

export interface FapiInvoice {
  id?: string;
  uuid?: string;
  folio_number?: number;
  series?: string;
  external_id?: string;
  status?: string;
  date?: string;
}
