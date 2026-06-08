/**
 * Serialización CSV: construir CSV simple desde filas/headers.
 * Extraído de `parseCsv.ts` en 12.61.18 (Sprint 2.1, Power-of-10 #1: ≤200 líneas).
 */
export function toCsv(headers: string[], rows: string[][], delimiter: "," | ";" = ","): string {
  const escape = (v: string): string => {
    if (v.includes('"') || v.includes(delimiter) || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(delimiter)];
  for (const r of rows) lines.push(r.map(escape).join(delimiter));
  return lines.join("\n");
}
