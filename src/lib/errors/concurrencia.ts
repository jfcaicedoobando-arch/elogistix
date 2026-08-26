/**
 * Bloqueo optimista (N-06, QA r2).
 *
 * Analogía: dos personas editando la misma hoja de papel. Al abrir el
 * formulario guardamos la "hora de la última firma" (`updated_at`). Si al
 * guardar esa firma ya cambió, alguien más escribió antes: en vez de pisar
 * su trabajo en silencio, avisamos y pedimos recargar.
 */
export const LC_CONFLICTO_CONCURRENCIA = "LC_CONFLICTO_CONCURRENCIA";

export const MENSAJE_CONFLICTO_CONCURRENCIA =
  "Otro usuario modificó este registro mientras lo editabas. Recarga la página para ver los datos actuales y vuelve a aplicar tus cambios.";

export function conflictoConcurrenciaError(): Error {
  return new Error(`${LC_CONFLICTO_CONCURRENCIA}: ${MENSAJE_CONFLICTO_CONCURRENCIA}`);
}

export function esConflictoConcurrencia(e: unknown): boolean {
  return e instanceof Error && e.message.includes(LC_CONFLICTO_CONCURRENCIA);
}
