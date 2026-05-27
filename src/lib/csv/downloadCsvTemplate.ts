/**
 * Descarga una plantilla CSV con BOM UTF-8 + headers + fila de ejemplo opcional.
 * Extraído de `BulkImportDialog` en 11.60.0 (Bloque B3).
 */
import { toCsv } from "@/lib/csv/parseCsv";

export function downloadCsvTemplate(
  headers: readonly string[],
  exampleRow: string[] | undefined,
  fileName: string,
): void {
  const rows = exampleRow ? [exampleRow] : [];
  const csv = toCsv([...headers], rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
