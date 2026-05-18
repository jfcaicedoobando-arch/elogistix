/**
 * @deprecated Movido a `services/admin/exportOrg` + `lib/io/{csv,zipDownload}`.
 * Este archivo mantiene compatibilidad temporal y reensambla el flujo.
 */
import {
  fetchOrganizationExport,
  buildExportManifest,
  EXPORT_TABLES,
  type ExportProgress,
  type ProgressCallback,
} from "@/services/admin/exportOrg";
import { toCSV, downloadZip } from "@/lib/io";

export { EXPORT_TABLES };
export type { ExportProgress, ProgressCallback };

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
