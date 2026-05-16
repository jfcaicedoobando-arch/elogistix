export type ChangeType = "major" | "minor" | "patch";

export interface ChangelogEntry {
  version: string;
  date: string;
  type: ChangeType;
  title: string;
  /** Resumen breve (1 línea, user-facing). Si se omite, se deriva de description. */
  summary?: string;
  /** Descripción completa (puede contener detalle técnico). */
  description: string;
}

/**
 * `recentChangelog` mantiene SÓLO las entradas más recientes (top 5) para
 * minimizar el bundle del lazy-chunk de Changelog. NO es la fuente de verdad
 * de v8: chunk0.ts contiene la lista completa. Los loaders deduplican por
 * `version` para que el solapamiento (intencional) no genere repetidos en UI.
 *
 * Para agregar una nueva entrada, usa `npm run changelog:add` — el script
 * actualiza este archivo, chunk0 y APP_VERSION en una sola operación.
 */
export const recentChangelog: ChangelogEntry[] = [
  {
    version: "8.171.0",
    date: "2026-05-16",
    type: "minor",
    title: "Ola B.1 — Logging estructurado en edge functions",
    summary: "Nueva tabla app_logs y logger compartido capturan request_id, latencia, user/org y status_code de cada edge function.",
    description: "Migración crea public.app_logs con RLS (super_admin lee todo, admin lee su org) y función purge_app_logs_old() para retención de 30 días. Nuevo logger compartido escribe en paralelo a console y a la tabla; parse-csf migrado como smoke test. Base para /admin/diagnostico y alertas. APP_VERSION 8.171.0."
  },
  {
    version: "8.170.0",
    date: "2026-05-16",
    type: "patch",
    title: "Script ci:local para validar antes de pushear",
    description: "Nuevo comando 'bun run ci:local' que ejecuta lint, knip, tests y build en secuencia, replicando el pipeline de GitHub Actions para detectar fallos de CI antes del push.",
  },
  {
    version: "8.169.0",
    date: "2026-05-16",
    type: "minor",
    title: "Ola A.5 — Runbook de backup/restore y health-check",
    summary: "Documentación operativa para PITR, simulacro mensual y script SQL de verificación diaria de la base.",
    description: "Nuevo docs/operations.md con modelo de respaldos (PITR ≤5min RPO, snapshot diario 7d, snapshot lógico 90d), procedimiento paso a paso de Point-In-Time Restore, restore drill mensual obligatorio, y procedimientos manuales SQL (factura manual respetando snapshot A.4, reasignación de operador, alta de organización). Nuevo scripts/db/health-check.sql con conteos, huérfanas, soft-deleted y semáforo por tabla + verificación de auditoria_snapshots del día. APP_VERSION 8.169.0."
  },
  {
    version: "8.168.0",
    date: "2026-05-16",
    type: "minor",
    title: "Ola A.4 — Snapshots financieros inmutables",
    summary: "Facturas y proformas congelan tasa IVA, tipo de cambio y datos del cliente al emitirse; ya no se pueden modificar después.",
    description: "Triggers en facturas/proformas capturan snapshot_emision al pasar a Emitida/Pagada o aprobada/facturada. Modificar campos fiscales de una factura emitida lanza 'factura_inmutable' (UI muestra mensaje pidiendo nota de crédito). Helpers fetchFacturaSnapshot/fetchProformaSnapshot listos para reimpresión de PDFs. APP_VERSION 8.168.0."
  },
  {
    version: "8.167.0",
    date: "2026-05-16",
    type: "patch",
    title: "Ola A.3 (cont.) — Tests de integración para idempotencia",
    summary: "5 tests cubren doble-click y reintentos de red sobre crearEmbarqueRpc y consolidarProformas, verificando que no se duplican registros.",
    description: "Mock de supabase.rpc que simula idempotency_claim/store. Escenarios: doble-click, reintento tras error, control negativo. APP_VERSION 8.167.0."
  },
  {
    version: "8.166.0",
    date: "2026-05-16",
    type: "minor",
    title: "Ola A.3 (cont.) — Idempotencia en upload de documentos",
    summary: "Re-subir el mismo archivo no duplica registros: el path incluye el SHA-256 y la fila sólo se actualiza si cambia el contenido.",
    description: "uploadDocumentoEmbarque calcula hash del contenido, usa path determinístico y reclama idempotency_claim/store con fn='upload_documento_embarque'. APP_VERSION 8.166.0."
  },

];

/** Deduplica por version conservando la primera ocurrencia (recentChangelog gana). */
export function dedupeByVersion(entries: ChangelogEntry[]): ChangelogEntry[] {
  const seen = new Set<string>();
  const out: ChangelogEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.version)) continue;
    seen.add(e.version);
    out.push(e);
  }
  return out;
}

/**
 * Carga perezosa genérica de un major version. Hoy sólo v8 está soportado;
 * v1-v7 viven en `legacyChangelog`.
 */
export async function loadChangelogMajor(major: number): Promise<ChangelogEntry[]> {
  if (major === 8) {
    const mod = await import("./changelog/v8");
    return mod.changelogV8;
  }
  throw new Error(`Major ${major} no disponible vía loadChangelogMajor; usa loadLegacyChangelog`);
}

/** Carga perezosa del changelog histórico (v7.x y anteriores). */
export async function loadLegacyChangelog(): Promise<ChangelogEntry[]> {
  const mod = await import("./changelog/legacy");
  return mod.legacyChangelog;
}
