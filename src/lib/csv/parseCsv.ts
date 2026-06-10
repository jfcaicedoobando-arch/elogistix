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
 */

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

/**
 * Quita acentos, caracteres ocultos no imprimibles, baja a minúsculas y
 * reemplaza espacios por guiones bajos. Endurecido contra:
 *  - Zero-width: U+200B/C/D, U+2060, U+FEFF intermedio.
 *  - NBSP U+00A0 (convertido a espacio para que colapse con `\s+`).
 *  - Controles ASCII U+0000–U+001F y U+007F.
 */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Zero-width y BOM intermedio.
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    // NBSP → espacio normal para que el collapse `\s+` lo cubra.
    .replace(/\u00A0/g, " ")
    // Controles ASCII (incluye tab, \r, \n sueltos que pudieran colarse).
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function detectDelimiter(firstLine: string): "," | ";" {
  // Cuenta separadores fuera de comillas.
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && c === ",") commas++;
    else if (!inQuotes && c === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

/**
 * Construye la lista de headers efectivos: aplica alias, descarta vacíos,
 * deduplica con sufijo `_N`. Devuelve `effective` indexado por posición
 * (con `""` en columnas a ignorar) para que el mapeo de filas sea estable.
 */
function buildEffectiveHeaders(
  rawHeaders: string[],
  aliases: Record<string, string>,
): { effective: string[]; unique: string[] } {
  const effective: string[] = [];
  const seen = new Map<string, number>();
  let vacios = 0;
  const duplicados: string[] = [];

  for (const raw of rawHeaders) {
    const norm = normalizeHeader(raw);
    if (!norm) {
      effective.push("");
      vacios++;
      continue;
    }
    const aliased = aliases[norm] ?? norm;
    const count = seen.get(aliased) ?? 0;
    if (count === 0) {
      seen.set(aliased, 1);
      effective.push(aliased);
    } else {
      seen.set(aliased, count + 1);
      const suffixed = `${aliased}_${count + 1}`;
      duplicados.push(aliased);
      effective.push(suffixed);
    }
  }

  if (vacios > 0) {
    console.warn(`[parseCsv] ${vacios} encabezado(s) vacío(s) ignorado(s)`);
  }
  if (duplicados.length > 0) {
    console.warn(`[parseCsv] encabezados duplicados renombrados: ${duplicados.join(", ")}`);
  }
  const unique = effective.filter((h) => h !== "");
  return { effective, unique };
}

/**
 * Tokeniza un CSV ya normalizado (sin BOM, \n unificado) en filas.
 * State machine RFC 4180. Extraído de parseCsv para mantener su complejidad
 * por debajo del umbral del linter.
 */
function tokenize(cleaned: string, delimiter: "," | ";"): string[][] {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c !== '"') { field += c; continue; }
      if (cleaned[i + 1] === '"') { field += '"'; i++; continue; }
      inQuotes = false;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delimiter) { row.push(field); field = ""; continue; }
    if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

function buildAliasMap(raw?: Record<string, string>): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const nk = normalizeHeader(k);
    if (nk) aliases[nk] = normalizeHeader(v) || v;
  }
  return aliases;
}

function rowsFromRecords(records: string[][], effective: string[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < records.length; r++) {
    const raw = records[r];
    if (raw.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let idx = 0; idx < effective.length; idx++) {
      const h = effective[idx];
      if (!h) continue;
      obj[h] = (raw[idx] ?? "").trim();
    }
    rows.push(obj);
  }
  return rows;
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

