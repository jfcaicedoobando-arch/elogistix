/** Evento de trazabilidad compartido por lectura y traducción de dominio. */
export interface RefacturacionEventoRaw {
  id: string;
  ts: string;
  accion: string;
  usuario_email: string;
  entidad_nombre: string;
  detalles: Record<string, unknown>;
}
