/**
 * Helper compartido para el ciclo de vida de blobs de expedientes
 * documentales (cliente/proveedor). El commit en base de datos determina
 * el éxito de la operación; la limpieza de storage es siempre best-effort
 * y sólo se registra (nunca revierte una referencia ya confirmada ni
 * enmascara el error original de un fallo previo).
 */
import { deleteFile } from "@/services/storage";

/**
 * Borra un blob de storage sin propagar el error si falla. Se usa tanto
 * para limpiar el archivo nuevo cuando el INSERT/UPDATE posterior falla,
 * como para limpiar el blob anterior cuando un reemplazo/borrado ya quedó
 * confirmado en base de datos.
 */
export async function limpiarBlobBestEffort(path: string, contexto: string): Promise<void> {
  try {
    await deleteFile(path);
  } catch (e) {
    console.warn(`[documentoStorage] ${contexto}: no se pudo borrar el blob ${path}`, e);
  }
}

/**
 * Reemplazo documental: cuando el UPDATE que fija el nuevo `archivo` ya
 * quedó confirmado, el blob anterior se limpia en best-effort y sólo si
 * difiere del nuevo path. Nunca revierte la referencia ya guardada.
 */
export async function limpiarBlobAnteriorTrasReemplazo(
  oldPath: string,
  newPath: string,
  contexto: string,
): Promise<void> {
  if (oldPath === newPath) return;
  await limpiarBlobBestEffort(oldPath, contexto);
}
