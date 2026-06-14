/**
 * Servicio: export completo de la organización a CSVs paginados.
 *
 * Lee cada tabla operativa filtrando por `organization_id` (RLS asegura
 * aislamiento; el filtro explícito es defensa-en-profundidad). Pagina en
 * bloques de 1000 filas (límite Supabase).
 */
import { supabase } from "@/integrations/supabase/client";
import { toCSV, downloadZip } from "@/lib/io";

export const EXPORT_TABLES = [
  "clientes",
  "proveedores",
  "contactos_cliente",
  "embarques",
  "conceptos_costo",
  "conceptos_venta",
  "documentos_embarque",
  "eventos_embarque",
  "notas_embarque",
  "cotizaciones",
  "cotizacion_costos",
  "facturas",
  "conceptos_factura",
  "proformas",
  "proforma_conceptos_consolidados",
  "bitacora_actividad",
  "configuracion",
  "notificaciones_cliente",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

export interface ExportProgress {
  step: number;
  total: number;
  current: string;
  rows: number;
}

export type ProgressCallback = (p: ExportProgress) => void;

const PAGE = 1000;

export interface ExportTableResult {
  table: ExportTable;
  rows: Record<string, unknown>[];
}

/**
 * Itera todas las tablas y devuelve las filas por tabla, reportando progreso.
 * No genera CSV ni ZIP — esa responsabilidad vive en `lib/io/`.
 */
export async function fetchOrganizationExport(
  organizationId: string,
  onProgress?: ProgressCallback,
): Promise<ExportTableResult[]> {
  const out: ExportTableResult[] = [];
  const total = EXPORT_TABLES.length + 1;

  for (let i = 0; i < EXPORT_TABLES.length; i++) {
    const table = EXPORT_TABLES[i];
    onProgress?.({ step: i + 1, total, current: table, rows: 0 });
    const allRows: Record<string, unknown>[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("organization_id", organizationId)
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const page = (data ?? []) as Record<string, unknown>[];
      allRows.push(...page);
      onProgress?.({ step: i + 1, total, current: table, rows: allRows.length });
      if (page.length < PAGE) break;
      from += PAGE;
    }
    out.push({ table, rows: allRows });
  }
  return out;
}

export function buildExportManifest(organizationId: string, orgNombre: string): string {
  return JSON.stringify(
    {
      organization_id: organizationId,
      organization_nombre: orgNombre,
      generated_at: new Date().toISOString(),
      tables: EXPORT_TABLES,
      format: "CSV (RFC 4180 simplificado)",
      note: "Export generado client-side. Filas paginadas a 1000 por petición.",
    },
    null,
    2,
  );
}

/**
 * Orquesta el export completo: fetch + CSV + ZIP. Movido desde `src/utils/orgExportZip.ts`.
 */
export async function exportOrganizationZip(
  organizationId: string,
  orgNombre: string,
  onProgress?: ProgressCallback,
): Promise<void> {
  const results = await fetchOrganizationExport(organizationId, onProgress);
  const total = EXPORT_TABLES.length + 1;
  const files: Record<string, string> = {};
  for (const { table, rows } of results) {
    files[`${table}.csv`] = toCSV(rows);
  }
  onProgress?.({ step: total, total, current: "manifest.json", rows: 0 });
  files["manifest.json"] = buildExportManifest(organizationId, orgNombre);
  const safe = orgNombre.replace(/[^a-z0-9]/gi, "_");
  const fecha = new Date().toISOString().slice(0, 10);
  await downloadZip(`export-${safe}`, files, `libre-carga-export-${safe}-${fecha}.zip`);
}
