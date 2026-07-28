/**
 * Servicio: export completo de la organización a CSVs paginados.
 *
 * Lee cada tabla operativa filtrando por `organization_id` (RLS asegura
 * aislamiento; el filtro explícito es defensa-en-profundidad). Pagina en
 * bloques de 1000 filas (límite Supabase). Si una tabla falla con permiso
 * RLS o similar, se registra warning y se continúa (el ZIP no se aborta).
 */
import { supabase } from "@/integrations/supabase/client";
import { toCSV, downloadZip } from "@/lib/io";
import { EXPORT_TABLES } from "./exportOrg.tables";
import {
  buildExportManifest,
  isSoftError,
  type ExportTableResult,
  type ProgressCallback,
} from "./exportOrg.manifest";

// Re-exports para conservar el API público del módulo.
export {
  EXPORT_GROUPS,
  EXPORT_TABLES,
  FORBIDDEN_EXPORT_TABLES,
} from "./exportOrg.tables";
export {
  buildExportManifest,
  type ExportProgress,
  type ProgressCallback,
  type ExportTableResult,
  
} from "./exportOrg.manifest";
import { todayLocalISO } from "@/lib/date/today";

const PAGE = 1000;

/**
 * Itera todas las tablas y devuelve las filas por tabla, reportando progreso.
 * Si una tabla falla con error "suave" (permiso/tabla ausente), agrega
 * `warning` al resultado y continúa. Errores duros siguen abortando.
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
    let warning: string | undefined;
    let aborted = false;
    while (!aborted) {
      // Cast pragmático: `EXPORT_TABLES` incluye vistas y tablas cuyos tipos
      // el cliente genérico no puede resolver estáticamente sin explotar el TS.
      // SAFE-CAST: filtrado por `organization_id` + RLS.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              range: (a: number, b: number) => Promise<{
                data: Record<string, unknown>[] | null;
                error: { code?: string; message?: string } | null;
              }>;
            };
          };
        };
      })
        .from(table)
        .select("*")
        .eq("organization_id", organizationId)
        .range(from, from + PAGE - 1);
      if (error) {
        if (isSoftError(error)) {
          warning = `${error.code ?? "error"}: ${error.message ?? "sin mensaje"}`;
          break;
        }
        throw new Error(`${table}: ${error.message}`);
      }
      const page = (data ?? []) as Record<string, unknown>[];
      allRows.push(...page);
      onProgress?.({ step: i + 1, total, current: table, rows: allRows.length });
      if (page.length < PAGE) aborted = true;
      else from += PAGE;
    }
    out.push({ table, rows: allRows, warning });
  }
  return out;
}

/**
 * Orquesta el export completo: fetch + CSV + ZIP.
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
  files["manifest.json"] = buildExportManifest({ organizationId, orgNombre, results });
  const safe = orgNombre.replace(/[^a-z0-9]/gi, "_");
  const fecha = todayLocalISO();
  await downloadZip(`export-${safe}`, files, `libre-carga-export-${safe}-${fecha}.zip`);
}
