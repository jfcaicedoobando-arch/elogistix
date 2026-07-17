/**
 * Tipos de dominio para la bitácora de actividad.
 * Fuente única — `services/bitacora` y `hooks/shared/useBitacora` re-exportan.
 */

export interface EntradaBitacora {
  id: string;
  usuario_id: string;
  usuario_email: string;
  accion: string;
  modulo: string;
  entidad_id: string | null;
  entidad_nombre: string;
  detalles: Record<string, unknown>;
  created_at: string;
}

export interface FiltrosBitacora {
  modulo?: string;
  usuarioId?: string;
  entidadId?: string | null;
  fechaDesde?: string;
  fechaHasta?: string;
  limite?: number;
  pagina?: number;
  excluirLogin?: boolean;
  /** Filtra por una o varias acciones (OR). */
  acciones?: string[];
}
