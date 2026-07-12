/**
 * Tipos, helpers de error suave y builder del manifest para el export por organización.
 */
import { APP_VERSION } from "@/constants/appVersion";
import { EXPORT_GROUPS, EXPORT_TABLES } from "./exportOrg.tables";

export interface ExportProgress {
  step: number;
  total: number;
  current: string;
  rows: number;
}

export type ProgressCallback = (p: ExportProgress) => void;

export interface ExportTableResult {
  table: string;
  rows: Record<string, unknown>[];
  warning?: string;
}

/** Códigos PostgREST/Postgres que degradamos a warning (no abortan). */
export const SOFT_ERROR_CODES = new Set(["PGRST205", "42501", "42P01"]);

export function isSoftError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code && SOFT_ERROR_CODES.has(err.code)) return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("permission denied") || msg.includes("does not exist");
}

export interface ExportManifestInput {
  organizationId: string;
  orgNombre: string;
  results?: ExportTableResult[];
}

export function buildExportManifest(
  organizationIdOrInput: string | ExportManifestInput,
  orgNombre?: string,
): string {
  const input: ExportManifestInput = typeof organizationIdOrInput === "string"
    ? { organizationId: organizationIdOrInput, orgNombre: orgNombre ?? "" }
    : organizationIdOrInput;
  const rowsByTable: Record<string, number> = {};
  const warnings: Record<string, string> = {};
  for (const r of input.results ?? []) {
    rowsByTable[r.table] = r.rows.length;
    if (r.warning) warnings[r.table] = r.warning;
  }
  return JSON.stringify(
    {
      organization_id: input.organizationId,
      organization_nombre: input.orgNombre,
      generated_at: new Date().toISOString(),
      app_version: APP_VERSION,
      tables: EXPORT_TABLES,
      groups: EXPORT_GROUPS,
      rows_by_table: input.results ? rowsByTable : undefined,
      warnings: input.results && Object.keys(warnings).length > 0 ? warnings : undefined,
      format: "CSV (RFC 4180 simplificado)",
      note: "Export generado client-side. Filas paginadas a 1000 por petición. Excluye credenciales, control de acceso y logs internos.",
    },
    null,
    2,
  );
}
