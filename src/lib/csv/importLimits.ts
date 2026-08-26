/**
 * Topes de importación masiva CSV (N-05, QA r2).
 *
 * Sin límites, un archivo grande congelaba la pestaña al parsear y disparaba
 * miles de inserciones fila por fila. Los topes son de UX/estabilidad, no de
 * seguridad: la BD sigue validando cada fila con RLS y triggers.
 */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const IMPORT_MAX_FILAS = 1000;
export const IMPORT_LOTE_TAMANO = 200;
/** Inserciones simultáneas por lote (evita saturar la conexión). */
export const IMPORT_CONCURRENCIA = 5;

export function mensajeArchivoDemasiadoGrande(bytes: number): string {
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  return `El archivo pesa ${mb} MB y el máximo es 2 MB. Divídelo en varios archivos.`;
}

export function mensajeDemasiadasFilas(filas: number): string {
  return `El archivo tiene ${filas} filas y el máximo por importación es ${IMPORT_MAX_FILAS}. Divídelo en varios archivos.`;
}

/**
 * Ejecuta `fn` sobre cada elemento en lotes con concurrencia acotada.
 * Reporta el avance para que el diálogo muestre "X de Y".
 */
export async function procesarEnLotes<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  onProgreso?: (procesados: number) => void,
): Promise<void> {
  let procesados = 0;
  for (let i = 0; i < items.length; i += IMPORT_LOTE_TAMANO) {
    const lote = items.slice(i, i + IMPORT_LOTE_TAMANO);
    for (let j = 0; j < lote.length; j += IMPORT_CONCURRENCIA) {
      await Promise.all(lote.slice(j, j + IMPORT_CONCURRENCIA).map(fn));
      procesados += Math.min(IMPORT_CONCURRENCIA, lote.length - j);
      onProgreso?.(Math.min(procesados, items.length));
    }
  }
}
