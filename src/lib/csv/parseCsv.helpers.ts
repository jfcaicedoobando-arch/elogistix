/**
 * Helpers extraídos de `parseCsv.ts` para mantener el archivo principal
 * por debajo del umbral Power-of-10 (≤200 LOC) y aislar las piezas
 * reutilizables (normalización de headers, detección de delimitador,
 * parsing con PapaParse, construcción de headers efectivos y mapeo de filas).
 */
import Papa from "papaparse";

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
  const used = new Set<string>();
  let vacios = 0;
  const duplicados: string[] = [];

  for (const raw of rawHeaders) {
    const norm = normalizeHeader(raw);
    if (!norm) {
      effective.push("");
      vacios++;
      continue;
    }
    const aliased = Object.hasOwn(aliases, norm) ? aliases[norm] ?? norm : norm;
    let count = (seen.get(aliased) ?? 0) + 1;
    let name = count === 1 ? aliased : `${aliased}_${count}`;
    // La primera columna conserva su nombre; las siguientes usan un sufijo
    // libre, incluso si colisionan con un nombre que ya traía `_N` en el CSV.
    while (used.has(name)) {
      count++;
      name = `${aliased}_${count}`;
    }
    seen.set(aliased, count);
    used.add(name);
    effective.push(name);
    if (name !== aliased) {
      duplicados.push(aliased);
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
 * Lee un CSV ya normalizado (sin BOM, \n unificado) como arrays para que
 * aliases, columnas vacías/duplicadas y filas desiguales sigan bajo nuestras reglas.
 */
export function tokenize(cleaned: string, delimiter: "," | ";"): string[][] {
  // Papa interpreta `, "a,b"` como celdas sin comillas y puede perder columnas.
  // Rechazar ese formato no estándar; saltar campos citados completos protege
  // espacios/comillas escapadas que sí pertenecen al contenido (también multilínea).
  const paddedQuote = new RegExp(`(?:^|[${delimiter}\\n])"(?:[^"]|"")*"[^\\S\\n]*(?=[${delimiter}\\n]|$)|(^|[${delimiter}\\n])[^\\S\\n]+"`, "g");
  for (const match of cleaned.matchAll(paddedQuote)) {
    if (match[1] !== undefined) {
      throw new Error("CSV inválido: elimina los espacios antes de las comillas de apertura.");
    }
  }

  const { data, errors } = Papa.parse<string[]>(cleaned, {
    delimiter,
    newline: "\n",
    header: false,
    dynamicTyping: false,
  });
  const error = errors[0];
  if (error) {
    const detail = error.code === "MissingQuotes" ? "hay comillas sin cerrar" : "las comillas del campo no son válidas";
    throw new Error(`CSV inválido en la fila ${(error.row ?? 0) + 1}: ${detail}.`);
  }
  // Papa devuelve una fila vacía adicional tras el último salto de línea.
  if (cleaned.endsWith("\n")) data.pop();
  return data;
}

export function buildAliasMap(raw?: Record<string, string>): Record<string, string> {
  const aliases: [string, string][] = [];
  for (const [k, v] of Object.entries(raw ?? {})) {
    const nk = normalizeHeader(k);
    if (nk) aliases.push([nk, normalizeHeader(v) || v]);
  }
  return Object.fromEntries(aliases);
}

export function rowsFromRecords(
  records: string[][],
  effective: string[],
): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < records.length; r++) {
    const raw = records[r];
    if (raw.every((c) => c.trim() === "")) continue;
    const entries: [string, string][] = [];
    for (let idx = 0; idx < effective.length; idx++) {
      const h = effective[idx];
      if (!h) continue;
      entries.push([h, (raw[idx] ?? "").trim()]);
    }
    // fromEntries crea propiedades propias también para `__proto__`.
    rows.push(Object.fromEntries(entries));
  }
  return rows;
}
