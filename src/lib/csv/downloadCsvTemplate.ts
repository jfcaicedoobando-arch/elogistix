/**
 * Descarga una plantilla CSV con BOM UTF-8 + headers + fila de ejemplo opcional.
 * Extraído de `BulkImportDialog` en 11.60.0 (Bloque B3).
 */
import { toCsv } from "@/lib/csv/parseCsv";
import { descargarBlob } from "@/lib/downloadBlob";

export function downloadCsvTemplate(
  headers: readonly string[],
  exampleRow: string[] | undefined,
  fileName: string,
): void {
  const rows = exampleRow ? [exampleRow] : [];
  const csv = toCsv([...headers], rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  descargarBlob(blob, fileName);
}
