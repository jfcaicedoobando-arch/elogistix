/**
 * OLA 7 · O7.6 — Exportación CSV de leads y oportunidades.
 *
 * Sólo serializa lo que ya está en pantalla (filtrado y limitado por RLS),
 * así que un vendedor exporta únicamente su cartera.
 */
import { toCsv } from "@/lib/csv/serializeCsv";
import { formatFechaDia } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";
import type { CrmOportunidadRow } from "@/features/crm/types/oportunidades";

const LEAD_HEADERS = [
  "Empresa", "Contacto", "Email", "Teléfono", "Ciudad", "País",
  "Fuente", "Estado", "Score", "Vendedor", "Creado",
];

const OPORTUNIDAD_HEADERS = [
  "Nombre", "Cliente", "Monto estimado", "Moneda", "Probabilidad",
  "Vendedor", "Cierre estimado", "Creada",
];

function txt(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/** Fecha ISO → DD/MM/YYYY (es-MX) para abrir el CSV en Excel local. */
function fechaMx(iso: string | null | undefined): string {
  return formatFechaDia(iso, "");
}

export function buildLeadsCsv(rows: CrmLeadRow[]): string {
  return toCsv(
    LEAD_HEADERS,
    rows.map((l) => [
      txt(l.empresa), txt(l.contacto), txt(l.email), txt(l.telefono),
      txt(l.ciudad), txt(l.pais), txt(l.fuente), txt(l.estado),
      txt(l.score), txt(l.vendedor_email), fechaMx(l.created_at),
    ]),
  );
}

export function buildOportunidadesCsv(rows: CrmOportunidadRow[]): string {
  return toCsv(
    OPORTUNIDAD_HEADERS,
    rows.map((o) => [
      txt(o.nombre), txt(o.cliente_nombre), txt(o.monto_estimado), txt(o.moneda),
      txt(o.probabilidad), txt(o.vendedor_email),
      fechaMx(o.fecha_estimada_cierre), fechaMx(o.created_at),
    ]),
  );
}

/** Sufijo de archivo con la fecha del día en hora local (YYYY-MM-DD). */
export function sufijoFechaArchivo(hoy: Date = new Date()): string {
  return todayLocalISO(hoy);
}

export function exportarLeadsCsv(rows: CrmLeadRow[]): void {
  downloadCsvWithFeedback({
    filename: `leads_${sufijoFechaArchivo()}.csv`,
    csv: buildLeadsCsv(rows),
    rowCount: rows.length,
  });
}

export function exportarOportunidadesCsv(rows: CrmOportunidadRow[]): void {
  downloadCsvWithFeedback({
    filename: `oportunidades_${sufijoFechaArchivo()}.csv`,
    csv: buildOportunidadesCsv(rows),
    rowCount: rows.length,
  });
}
