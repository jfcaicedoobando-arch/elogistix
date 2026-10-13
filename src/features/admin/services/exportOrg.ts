/**
 * Extracción del catálogo de organización a CSVs paginados.
 * Conserva filas activas y bajas lógicas visibles por RLS, incluidos sus IDs,
 * relaciones y marcas de baja; no impone vigencia al catálogo mixto.
 * Cada página filtra organization_id. Errores suaves conservan lo obtenido
 * con warning; los duros abortan. No certifica snapshot ni restauración.
 * Contrato y límites: docs/historical-read-contracts.md.
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
      // Cast pragmático para el catálogo cerrado de `EXPORT_TABLES`;
      // no amplía destinos ni permite saltarse los permisos del servidor.
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
        // SOFT-DELETE-OK: catálogo con bajas visibles; contrato acotado en docs/historical-read-contracts.md.
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
