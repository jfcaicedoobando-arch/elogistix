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

/** Cursor keyset para la paginación de la bitácora (QA B-27). */
export interface CursorBitacora {
  createdAt: string;
  id: string;
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
  /** R6-FIX3: acota la lectura a una organización (evita mezclas por impersonación). */
  organizationId?: string | null;
  /** Filtra por una o varias acciones (OR). */
  acciones?: string[];
  /**
   * QA B-27 — Cursor keyset `(created_at, id)` de la última fila de la página
   * anterior. Cuando viene, la consulta usa keyset en lugar de offset
   * (`range`), que se degrada en tablas grandes.
   */
  cursor?: CursorBitacora | null;
}
