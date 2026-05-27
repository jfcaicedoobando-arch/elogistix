/**
 * Parser y mapper de CSV para importación de leads del CRM.
 * Puro (sin React, sin Supabase). Tests en `__tests__/leadsCsv.test.ts`.
 *
 * Extraído de `components/crm/ImportarLeadsCsvDialog.tsx` en 11.60.0 (Bloque B2).
 */
import {
  LEAD_ESTADOS,
  LEAD_FUENTES,
  type CrmLeadEstado,
  type CrmLeadFuente,
} from "@/lib/crm/leads/constants";

export interface ParsedLeadRow {
  empresa: string;
  contacto: string;
  email: string;
  telefono: string;
  ciudad: string;
  pais: string;
  fuente: CrmLeadFuente;
  estado: CrmLeadEstado;
  score: number;
  notas: string;
  __error?: string;
}

export const LEAD_CSV_HEADER_ALIASES: Record<string, keyof ParsedLeadRow> = {
  empresa: "empresa", company: "empresa", razon_social: "empresa",
  contacto: "contacto", nombre: "contacto", contact: "contacto",
  email: "email", correo: "email", "e-mail": "email",
  telefono: "telefono", phone: "telefono", "teléfono": "telefono", tel: "telefono",
  ciudad: "ciudad", city: "ciudad",
  pais: "pais", "país": "pais", country: "pais",
  fuente: "fuente", source: "fuente",
  estado: "estado", status: "estado",
  score: "score",
  notas: "notas", notes: "notas",
};

/** Parser CSV sencillo (RFC4180 subset): comillas dobles, escape "". */
export function parseLeadsCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function mapLeadCsvRows(matrix: string[][]): ParsedLeadRow[] {
  if (matrix.length === 0) return [];
  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const colMap = headers.map((h) => LEAD_CSV_HEADER_ALIASES[h] ?? null);
  return matrix.slice(1).map((cols) => {
    const r: ParsedLeadRow = {
      empresa: "", contacto: "", email: "", telefono: "",
      ciudad: "", pais: "", fuente: "Otro", estado: "Nuevo", score: 3, notas: "",
    };
    colMap.forEach((field, i) => {
      if (!field) return;
      const val = (cols[i] ?? "").trim();
      if (field === "score") {
        const n = Number(val);
        r.score = Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3;
      } else if (field === "fuente") {
        r.fuente = (LEAD_FUENTES as readonly string[]).includes(val) ? (val as CrmLeadFuente) : "Otro";
      } else if (field === "estado") {
        r.estado = (LEAD_ESTADOS as readonly string[]).includes(val) ? (val as CrmLeadEstado) : "Nuevo";
      } else {
        // SAFE-CAST: asignación dinámica por campo CSV. `field` proviene de
        // un mapping validado contra las claves de ParsedLeadRow.
        (r as unknown as Record<string, string>)[field] = val;
      }
    });
    if (!r.empresa) r.__error = "Empresa requerida";
    return r;
  });
}
