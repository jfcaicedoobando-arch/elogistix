/**
 * Exportación de objetos a CSV mediante PapaParse.
 */
import Papa from "papaparse";
import { neutralizarFormulaCsv } from "../csv/serializeCsv";

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    // N35 (Ola 4): CSV injection.
    return neutralizarFormulaCsv(typeof v === "object" ? JSON.stringify(v) : String(v));
  };
  // Conservar también los registros vacíos finales del export histórico.
  if (headers.length === 0) return "\n".repeat(rows.length);
  return Papa.unparse({
    fields: headers.map(neutralizarFormulaCsv),
    data: rows.map((row) => headers.map((h) => cell(row[h]))),
  }, { delimiter: ",", newline: "\n" });
}
