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
import { APP_VERSION } from "@/constants/appVersion";

/**
 * Tablas agrupadas por dominio. El listado plano `EXPORT_TABLES` se deriva
 * de este objeto para mantener un único punto de verdad.
 *
 * Excluidas deliberadamente (ver plan de auditoría 13.287.0):
 *   - facturapi_credenciales (secretos PAC)
 *   - organization_members, agente_users, client_users (control de acceso)
 *   - tracking_intentos, tracking_links, tracking_webhook_log (ruido infra)
 *   - app_logs, idempotency_keys, folio_secuencias, notificaciones_internas
 *   - cotizacion_costos_historico, catalogo_claves_sat (catálogos/logs)
 *   - _backup_*, vistas v_*
 */
export const EXPORT_GROUPS = {
  "Maestros comerciales": [
    "clientes",
    "proveedores",
    "contactos_cliente",
  ],
  "Operación de embarques": [
    "embarques",
    "embarque_contenedores",
    "embarque_garantias_contenedor",
    "eventos_embarque",
    "documentos_embarque",
    "notas_embarque",
    "seguros_embarque",
    "tracking_externo",
    "cierre_embarque_log",
    "conceptos_costo",
    "conceptos_venta",
  ],
  "Cotizaciones y proformas": [
    "cotizaciones",
    "cotizacion_costos",
    "cotizacion_envios",
    "proformas",
    "proforma_conceptos_consolidados",
    "proforma_envios",
  ],
  "Facturación y cobranza": [
    "facturas",
    "conceptos_factura",
    "factura_notas_credito",
    "factura_series",
    "factura_embarques",
    "factura_envios",
    "factura_recordatorios",
    "pagos_factura",
    "cobranza_seguimiento",
    "proveedor_facturas",
    "proveedor_facturas_conceptos",
    "proveedor_notas_credito",
    "pagos_proveedor",
  ],
  "Tesorería": [
    "bbva_movimientos",
    "cuentas_bancarias",
  ],
  "Costeo y tarifas": [
    "costeo_tarifas",
    "costeo_tarifa_recargos",
    "costeo_rutas",
    "costeo_agentes",
    "costeo_navieras_condiciones",
    "costeo_naviera_demoras_tarifa",
    "costeo_demoras_venta_tarifa",
  ],
  "CRM": [
    "crm_leads",
    "crm_oportunidades",
    "crm_actividades",
    "crm_comentarios_oportunidad",
    "crm_etapas_pipeline",
    "crm_motivos_perdida",
    "crm_plantillas_mensaje",
    "crm_cuotas_vendedor",
    "crm_notificaciones",
  ],
  "Comisiones y presupuesto": [
    "comisiones_devengadas",
    "liquidaciones_comision",
    "presupuesto_categorias",
    "presupuesto_mensual",
  ],
  "Auditoría interna": [
    "auditoria_revisiones",
    "auditoria_snapshots",
    "auditoria_comentarios",
  ],
  "Configuración y otros": [
    "configuracion",
    "vendedora_config",
    "notificaciones_cliente",
    "bitacora_actividad",
  ],
} as const satisfies Record<string, readonly string[]>;

export const EXPORT_TABLES = Object.values(EXPORT_GROUPS).flat() as readonly string[];

/** Tablas que NUNCA deben aparecer en el export. Consumido por el test smoke. */
export const FORBIDDEN_EXPORT_TABLES = [
  "facturapi_credenciales",
  "organization_members",
  "agente_users",
  "client_users",
  "app_logs",
  "idempotency_keys",
  "folio_secuencias",
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
  table: string;
  rows: Record<string, unknown>[];
  warning?: string;
}

/** Códigos PostgREST/Postgres que degradamos a warning (no abortan). */
const SOFT_ERROR_CODES = new Set(["PGRST205", "42501", "42P01"]);

function isSoftError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code && SOFT_ERROR_CODES.has(err.code)) return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("permission denied") || msg.includes("does not exist");
}

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
  const fecha = new Date().toISOString().slice(0, 10);
  await downloadZip(`export-${safe}`, files, `libre-carga-export-${safe}-${fecha}.zip`);
}
