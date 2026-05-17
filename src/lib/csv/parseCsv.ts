/**
 * Bloque 3.1 — Parser CSV ligero, RFC 4180 (campos entre comillas, comas
 * dentro de comillas, comillas dobles escapadas como ""). No agregamos
 * papaparse para no inflar el bundle: el caso de uso (importación de
 * clientes/proveedores) cabe sin streaming.
 *
 * Convención:
 *  - El separador se autodetecta entre `,` y `;` mirando la primera línea.
 *  - La primera fila es la de encabezados; se normaliza con `normalizeHeader`.
 *  - Se omiten líneas completamente vacías.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: "," | ";";
}

/** Quita acentos, baja a minúsculas y reemplaza espacios por guiones bajos. */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

export function parseCsv(input: string): ParsedCsv {
  // Quita BOM y normaliza saltos de línea.
  const cleaned = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!cleaned.trim()) {
    return { headers: [], rows: [], delimiter: "," };
  }

  const firstNewline = cleaned.indexOf("\n");
  const firstLine = firstNewline === -1 ? cleaned : cleaned.slice(0, firstNewline);
  const delimiter = detectDelimiter(firstLine);

  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === delimiter) {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        records.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  // Última celda/fila si el archivo no termina en \n.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  if (records.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const headers = records[0].map(normalizeHeader);
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < records.length; r++) {
    const raw = records[r];
    // Omitir filas completamente vacías.
    if (raw.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      obj[h] = (raw[idx] ?? "").trim();
    });
    rows.push(obj);
  }

  return { headers, rows, delimiter };
}

/** Construye un CSV simple a partir de filas (útil para exportar plantillas). */
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
