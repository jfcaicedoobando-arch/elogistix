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
    version: "8.183.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.5 — Bitácora virtualizada con tamaño de página",
    summary: "Nuevo selector de 30/60/120/300 en /bitacora; al pasar de 60 filas se activa @tanstack/react-virtual para mantener el scroll fluido.",
    description: "BitacoraActividad expone virtualize+maxHeight (default 600px) y la página /bitacora alterna automáticamente entre render lineal y virtualizado según el tamaño cargado. APP_VERSION 8.183.0."
  },
  {
    version: "8.182.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.2 — Validación zod en mutaciones",
    summary: "Nuevos schemas zod en cliente, cotización, embarque y notas validan los payloads antes de tocar la base; parseOrThrow surface errores legibles.",
    description: "src/lib/validation/mutationSchemas.ts centraliza la última red de seguridad antes de los inserts/updates: createCliente, updateCliente, crearCotizacion, crearEmbarqueRpc, insertarNotaEmbarque e insertarNotaCambioEstado pasan por parseOrThrow. 15 tests nuevos verdes. APP_VERSION 8.182.0."
  },
  {
    version: "8.181.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.4 — N+1 fase 2 en cotizaciones, clientes y proveedores",
    summary: "RPCs *_listado con agregados (embarques, cotizaciones, deuda, operaciones, pendiente) eliminan llamadas extra desde la UI.",
    description: "cotizaciones_listado, clientes_listado y proveedores_listado siguen el patrón de B.4 con SECURITY INVOKER. fetchClientesPaginados y fetchProveedoresPaginados ahora consumen las RPCs y devuelven ítems enriquecidos sin romper consumidores. fetchCotizacionesListado se expone para futuras pantallas paginadas. APP_VERSION 8.181.0."
  },
  {
    version: "8.180.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.1 — Crashes de UI reportados a app_logs",
    summary: "Edge function client-error-log + ErrorBoundary: cualquier excepción en la UI se persiste con fn='client' y dispara alertas internas si se repite.",
    description: "client-error-log (verify_jwt=false) recibe {message, stack, component_stack, route, user_agent, app_version}, captura user_id desde JWT cuando existe e inserta en app_logs como error status 500. ErrorBoundary lo invoca fire-and-forget en componentDidCatch (excepto en ChunkLoadError, que sigue recargando). ≥5 crashes en 5 min disparan alerta automática vía el cron existente. APP_VERSION 8.180.0."
  },
  {
    version: "8.179.0",
    date: "2026-05-17",
    type: "patch",
    title: "Bloque 1.5 — Linter resuelto y documentado",
    summary: "search_path fijo en is_soft_delete_table y app_logs INSERT endurecido. Warnings restantes justificados en docs/linter-warnings.md. Cierra Bloque 1.",
    description: "Fix de los dos warnings accionables del linter: is_soft_delete_table con SET search_path = public (lint 0011) y nueva política 'app_logs insert authenticated' (authenticated + user_id = auth.uid() o nulo) que elimina el WITH CHECK = true (lint 0024). Los 67 warnings restantes (pg_trgm en public + 66 SECURITY DEFINER intencionales) quedan documentados como aceptados. APP_VERSION 8.179.0."
  },
  {
    version: "8.178.0",
    date: "2026-05-17",
    type: "minor",
    title: "Hardening + Alertas internas del sistema",
    summary: "HIBP activado; nueva tabla alertas_sistema con detección automática cada 5 min y panel en /admin/diagnostico.",
    description: "Bloque 1: 1.4 Hardening auth (password_hibp_enabled=true bloquea contraseñas filtradas) + 1.2 Alertas internas. Tabla alertas_sistema (RLS super_admin), función detectar_alertas_app_logs() agrupa errores por function_name en ventanas de 5 min (≥5 = alerta, ≥20 = critical), cron pg_cron */5 min, dedupe_key por hora. Hook useAlertasSistema, AlertasSistemaPanel (lista, severity, reconocer), pestaña Alertas en Diagnóstico y badge rojo en 'Panel Admin'. APP_VERSION 8.178.0."
  },
  {
    version: "8.177.0",
    date: "2026-05-17",
    type: "minor",
    title: "Ola C.2 — Dashboard de salud en /admin/diagnostico",
    summary: "Nueva pestaña Salud con KPIs, línea de tiempo, top funciones con errores y top más lentas (p95) sobre app_logs.",
    description: "RPCs app_logs_health_summary y app_logs_health_timeline (SECURITY INVOKER, respetan RLS multi-tenant). Hook useAppLogsHealth con auto-refresh 60s y rangos 1h/6h/24h/7d. DiagnosticoHealthPanel renderiza Recharts (LineChart timeline + BarChart top errores) y tabla de p95. /admin/diagnostico dividido en pestañas Salud / Bitácora. APP_VERSION 8.177.0."
  },
  {
    version: "8.176.0",
    date: "2026-05-17",
    type: "minor",
    title: "Ola C.1 — Logger en todas las edge functions",
    summary: "Las 9 edge functions restantes escriben a app_logs vía createLogger + log.finish().",
    description: "exchange-rates, create-user, delete-user, list-users, tracking-public, auditoria-snapshot-daily, auditoria-weekly-digest, invite-client-user y jsoncargo-track instrumentadas. Cada return llama log.finish(status, msg, ctx). /admin/diagnostico ahora muestra tráfico real de todas las funciones. APP_VERSION 8.176.0."
  },
  {
    version: "8.175.0",
    date: "2026-05-17",
    type: "minor",
    title: "Ola B.6 — Suite de tests de RLS multi-tenant",
    summary: "Script SQL verifica aislamiento entre organizaciones para 8 escenarios críticos (clientes, embarques, app_logs, bitácora).",
    description: "supabase/tests/rls/test_rls_isolation.sql siembra dos organizaciones y simula cada usuario vía request.jwt.claims; cubre lectura aislada, updates cruzados bloqueados, alcance del portal cliente, app_logs por tenant e insert con usuario_id falso rechazado. Ejecutar con psql -f sobre staging. APP_VERSION 8.175.0."
  },
  {
    version: "8.174.0",
    date: "2026-05-17",
    type: "minor",
    title: "Ola B.5 — Virtualización de listas largas",
    summary: "Nuevo VirtualDataTable basado en @tanstack/react-virtual; /admin/diagnostico soporta 500 filas con payload expansible sin caída de FPS.",
    description: "VirtualDataTable comparte contrato de columnas con DataTable pero renderiza con grid + filas absolutas y measureElement para alturas variables. Header sticky, zebra, hover, pagination embebida. Diagnóstico ahora admite page size 500 con overscan 12 y maxHeight 640px. APP_VERSION 8.174.0."
  },
  {
    version: "8.173.0",
    date: "2026-05-17",
    type: "minor",
    title: "Ola B.4 — Reducción de N+1 vía RPCs *_listado",
    summary: "Nuevas RPCs embarques_listado, facturas_listado y reportes_resumen consolidan filas + conteos + KPIs en una sola llamada.",
    description: "embarques_listado devuelve filas paginadas + costos/docs agregados + total_count en un solo round-trip. facturas_listado pagina server-side con proforma_numero embebido. reportes_resumen calcula rentabilidad y KPIs en BD. Hooks migrados (useEmbarquesPageState/Controller, useRentabilidadClientes, useFacturas) eliminan la llamada secundaria a embarques_list_extras y la agregación client-side. APP_VERSION 8.173.0."
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
