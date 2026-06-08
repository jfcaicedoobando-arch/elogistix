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
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const headerLine = headers.map((h) => escape(h.label)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escape(row[h.key])).join(","),
  );

  const csv = [headerLine, ...dataLines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  descargarBlob(blob, filename);
}
