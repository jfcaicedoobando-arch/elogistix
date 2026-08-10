/**
 * Serialización CSV vía `papaparse.unparse` (ya instalado).
 * Lote 9a — reemplazo del serializer manual por la utilidad estándar.
 */
import Papa from "papaparse";

/**
 * N35 (Ola 4): neutraliza inyección de fórmulas (CSV injection). Los
 * conceptos/referencias del estado de cuenta vienen de archivos externos
 * importados; al abrir el export en Excel una celda que inicia con
 * = + - @ (o tab/CR) se ejecuta como fórmula. Anteponemos comilla simple.
 */
export function neutralizarFormulaCsv(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

export function toCsv(headers: string[], rows: string[][], delimiter: "," | ";" = ","): string {
  const out = Papa.unparse(
    {
      fields: headers.map(neutralizarFormulaCsv),
      data: rows.map((r) => r.map((c) => neutralizarFormulaCsv(String(c ?? "")))),
    },
    { delimiter, newline: "\n" },
  );
  return out.replace(/\n+$/, "");
}
