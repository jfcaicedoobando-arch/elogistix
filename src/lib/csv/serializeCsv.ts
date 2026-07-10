/**
 * Serialización CSV vía `papaparse.unparse` (ya instalado).
 * Lote 9a — reemplazo del serializer manual por la utilidad estándar.
 */
import Papa from "papaparse";

export function toCsv(headers: string[], rows: string[][], delimiter: "," | ";" = ","): string {
  return Papa.unparse({ fields: headers, data: rows }, { delimiter, newline: "\n" });
}
