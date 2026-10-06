/** Datos editables antes del timbrado, independientes del formulario y de I/O. */
export interface DatosTimbradoPatch {
  serie?: string;
  uso_cfdi: string;
  forma_pago: string;
  metodo_pago: string;
  dias_credito?: number;
  notas?: string | null;
  tipo_cambio?: number | null;
  fecha_emision?: string;
}
