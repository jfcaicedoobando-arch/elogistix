/**
 * Helpers extraídos de `parseCsv.ts` para mantener el archivo principal
 * por debajo del umbral Power-of-10 (≤200 LOC) y aislar las piezas
 * reutilizables (normalización de headers, detección de delimitador,
 * tokenizer RFC 4180, construcción de headers efectivos y mapeo de filas).
 */

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
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function detectDelimiter(firstLine: string): "," | ";" {
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
 * deduplica con sufijo `_N`. `effective` indexado por posición (con `""`
 * en columnas a ignorar) para que el mapeo de filas sea estable.
 */
export function buildEffectiveHeaders(
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
 * State machine RFC 4180.
 */
export function tokenize(cleaned: string, delimiter: "," | ";"): string[][] {
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

export function buildAliasMap(raw?: Record<string, string>): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const nk = normalizeHeader(k);
    if (nk) aliases[nk] = normalizeHeader(v) || v;
  }
  return aliases;
}

export function rowsFromRecords(
  records: string[][],
  effective: string[],
): Record<string, string>[] {
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
