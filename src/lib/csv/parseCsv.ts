/**
 * Bloque 3.1 — Parser CSV ligero, RFC 4180 (campos entre comillas, comas
 * dentro de comillas, comillas dobles escapadas como ""). No agregamos
 * papaparse para no inflar el bundle: el caso de uso (importación de
 * clientes/proveedores) cabe sin streaming.
 *
 * Convención:
 *  - El separador se autodetecta entre `,` y `;` mirando la primera línea.
 *  - La primera fila es la de encabezados; se normaliza con `normalizeHeader`,
 *    saneando además caracteres ocultos (BOM intermedio, zero-width, NBSP,
 *    controles) que llegan desde Excel/Google Sheets.
 *  - Se omiten líneas completamente vacías.
 *  - Headers vacíos (por comas sobrantes) se descartan defensivamente.
 *  - Headers duplicados tras la normalización se sufijan `_2`, `_3`, …
 *  - Opcionalmente se aplica un mapa de alias para tolerar variaciones menores.
 *
 * Las piezas internas (normalización, tokenizer, mapeo) viven en
 * `./parseCsv.helpers.ts` para mantener este archivo ≤200 LOC.
 */
import {
  normalizeHeader,
  detectDelimiter,
  tokenize,
  buildEffectiveHeaders,
  buildAliasMap,
  rowsFromRecords,
} from "./parseCsv.helpers";

export { normalizeHeader } from "./parseCsv.helpers";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: "," | ";";
}

export interface ParseCsvOptions {
  /**
   * Reescribe headers ya normalizados. Útil para tolerar variaciones menores
   * sin tocar cada importador (ej. `{ correo: "email", tel: "telefono" }`).
   * Las claves se normalizan internamente (defensivo).
   */
  headerAliases?: Record<string, string>;
}

export function parseCsv(input: string, options: ParseCsvOptions = {}): ParsedCsv {
  const cleaned = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!cleaned.trim()) {
    return { headers: [], rows: [], delimiter: "," };
  }

  const firstNewline = cleaned.indexOf("\n");
  const firstLine = firstNewline === -1 ? cleaned : cleaned.slice(0, firstNewline);
  const delimiter = detectDelimiter(firstLine);

  const records = tokenize(cleaned, delimiter);
  if (records.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const aliases = buildAliasMap(options.headerAliases);
  const { effective, unique } = buildEffectiveHeaders(records[0], aliases);
  const rows = rowsFromRecords(records, effective);
  return { headers: unique, rows, delimiter };
}

// Re-export para mantener API estable. La implementación vive en `serializeCsv.ts`.
export { toCsv } from "./serializeCsv";
