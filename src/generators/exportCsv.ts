/**
 * Genera y descarga un archivo CSV desde datos tabulares.
 *
 * `headers` es `readonly` para aceptar arreglos `as const` sin necesidad
 * de casts en el call-site (ver D16 — 11.64.0).
 */
import { descargarBlob } from "@/lib/downloadBlob";

export interface CsvHeader {
  readonly key: string;
  readonly label: string;
}

export function exportToCsv(
  filename: string,
  headers: ReadonlyArray<CsvHeader>,
  rows: ReadonlyArray<Record<string, unknown>>,
) {
  const escape = (val: unknown): string => {
    const str = val == null ? "" : String(val);
    // EC-07: CSV injection — Excel/LibreOffice ejecutan como fórmula las
    // celdas que empiezan con = + - @ (o tab/CR). Se prefijan con "'" para
    // neutralizarlas. Excepción: los valores numéricos (p. ej. montos
    // negativos "-1234.50") se dejan intactos para no romper los reportes.
    const esNumero = str.trim() !== "" && Number.isFinite(Number(str));
    const safe = !esNumero && /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return safe.includes(",") || safe.includes('"') || safe.includes("\n")
      ? `"${safe.replace(/"/g, '""')}"`
      : safe;
  };


  const headerLine = headers.map((h) => escape(h.label)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escape(row[h.key])).join(","),
  );

  const csv = [headerLine, ...dataLines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  descargarBlob(blob, filename);
}
