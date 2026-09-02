/**
 * Helper compartido para el ciclo de vida de blobs de expedientes
 * documentales (cliente/proveedor). El commit en base de datos determina
 * el éxito de la operación; la limpieza de storage es siempre best-effort:
 * se registra (console.warn) pero nunca revierte una referencia ya
 * confirmada ni enmascara el error original de un fallo previo.
 */
import { deleteFile } from "@/services/storage";

/** Borra un blob de storage sin propagar el error si falla; sólo lo registra. */
export async function limpiarBlobBestEffort(path: string, contexto: string): Promise<void> {
  try {
    await deleteFile(path);
  } catch (e) {
    console.warn(`[documentoStorage] ${contexto}: no se pudo borrar el blob ${path}`, e);
  }
}

/**
 * Reemplazo documental: una vez confirmado el UPDATE que fija el nuevo
 * `archivo`, limpia en best-effort el blob anterior sólo si difiere del
 * nuevo path (evita borrar el archivo que sigue en uso).
 */
export async function limpiarBlobAnteriorTrasReemplazo(
  oldPath: string,
  newPath: string,
  contexto: string,
): Promise<void> {
  if (oldPath === newPath) return;
  await limpiarBlobBestEffort(oldPath, contexto);
}
