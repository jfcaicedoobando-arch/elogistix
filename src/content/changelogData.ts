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
 * `recentChangelog` mantiene SÓLO las entradas más recientes (top 10) para
 * minimizar el bundle del lazy-chunk de Changelog. NO es la fuente de verdad
 * de v8: chunk0.ts contiene la lista completa. Los loaders deduplican por
 * `version` para que el solapamiento (intencional) no genere repetidos en UI.
 *
 * Para agregar una nueva entrada, usa `npm run changelog:add` — el script
 * actualiza este archivo, chunk0 y APP_VERSION en una sola operación.
 */
export const recentChangelog: ChangelogEntry[] = [
  {
    version: "11.12.0",
    date: "2026-05-25",
    type: "minor",
    title: "Cierre P2: tests edge functions + zipDownload + exportCsv",
    summary: "7 archivos nuevos (5 Deno + 2 Vitest): parse-csf, jsoncargo-track, invite-client-user, client-error-log, auditoria-weekly-digest, zipDownload, exportCsv.",
    description: "Helpers puros exportados en edge functions y suite Vitest extendida. Total ~595 tests verdes. APP_VERSION 11.12.0.",
  },
  {
    version: "11.11.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría de tests — 3 tandas (P0+P1+P2) +18 archivos / +83 tests",
    summary: "Cobertura de servicios financieros críticos (hueco facturación, proyección, proforma), portal cliente, observability y edge functions.",
    description: "Tanda A (P0 servicios): idempotencia, embarque/contenedor, proforma/consolidar, proforma/facturar, cliente/financials, facturas/huecoFacturacion, facturas/proyeccion + helper _supabaseChainMock + Deno cors_test. Tanda B (P1 hooks): extracción lib/facturacion/huecoCsv, tests para useCotizacionPL, useCreateTrackingLink y extensión de embarqueWizard (resolveExpedienteForSubmit + buildBitacoraDetalles). Tanda C (P2): portal/columns, portal/queries, observability/logClientError. Total: 82 archivos / 583 tests verdes. APP_VERSION 11.11.0.",
  },
  {
    version: "11.10.0",
    date: "2026-05-25",
    type: "minor",
    title: "Cobertura Vitest +6 archivos / +33 tests (P2 + extracciones)",
    summary: "Tests para columnas de embarque, tracking externo, configuración, idempotency, KPIs de embarque y chart de desempeño.",
    description: "Nuevos tests: services/embarque/columns, lib/jsoncargo/externalTracking, lib/domain/configuracion, lib/idempotency (newRequestId + useStableRequestId), lib/financial/embarqueKpis (extraído de useEmbarqueFinancials), lib/operaciones/desempenoChart (extraído de useDesempenoChartData). 6 archivos / 33 casos verdes. APP_VERSION 11.10.0.",
  },
  {
    version: "11.9.0",
    date: "2026-05-25",
    type: "minor",
    title: "Cobertura Vitest +12 archivos / +62 tests (P0+P1)",
    summary: "Tests puros para lógica crítica financiera, XSS, wizard de embarques, mappers de cotización y utilidades compartidas.",
    description: "Nuevos tests vitest: costosUSD, htmlEscape (XSS), embarqueWizardCostos, embarqueWizardDocumentos, validationFormat, errorCatalog, auth/resolveLandingRoute, io/csv (RFC 4180), containerPrefixes (BIC + leasing pool), useDebounce (fake timers), mappers/buildPaso1Data (FCL/LCL/Aéreo/Terrestre), auditoriaCsv. 12 archivos / 62 casos, todos verdes. APP_VERSION 11.9.0.",
  },
  {
    version: "11.8.0",
    date: "2026-05-25",
    type: "minor",
    title: "Sprint T1+T2: tests del CRM y de edge functions",
    summary: "Cobertura: 24 tests nuevos en CRM y 7 tests Deno (checkAdminAccess, validatePayload).",
    description: "Extracción de lógica pura a src/lib/crm/ (forecast, proximasActividades, cliente360) y tests vitest+Deno. APP_VERSION 11.8.0.",
  },
  {
    version: "11.7.3",
    date: "2026-05-25",
    type: "patch",
    title: "Fix edge function list-users: permitir miembros de la organización",
    summary: "Operadores y vendedores ya no reciben 403 al cargar /crm/oportunidades ni selects de vendedor/responsable.",
    description: "list-users ahora permite a cualquier miembro de la org listar usuarios de su propia organización (respuesta filtrada por organization_members). create-user/delete-user/invite-client-user mantienen check estricto de admin. APP_VERSION 11.7.3.",
  },
  {
    version: "11.7.2",
    date: "2026-05-25",
    type: "patch",
    title: "Fix cron de alertas: columnas correctas en app_logs",
    summary: "Fix cron de alertas: usa columnas reales fn/ts/status_code de app_logs en vez de inexistentes.",
    description: "Migración recrea detectar_alertas_app_logs() con los nombres correctos de columna. El cron ahora agrupa errores 5xx y genera alertas sin abortar. APP_VERSION 11.7.2.",
  },
  {
    version: "11.7.1",
    date: "2026-05-25",
    type: "patch",
    title: "Fix CRM Dashboard: relaciones faltantes en crm_oportunidades",
    summary: "Fix CRM Dashboard: llaves foráneas faltantes en crm_oportunidades.",
    description: "Migración agrega FKs hacia crm_etapas_pipeline, clientes, crm_leads y crm_motivos_perdida para que PostgREST resuelva los embeds inner del dashboard. Índices nuevos para joins. APP_VERSION 11.7.1.",
  },
  {
    version: "11.7.0",
    date: "2026-05-25",
    type: "minor",
    title: "CRM Sprint G: pulido UX — menos pestañas, más foco",
    summary: "7 → 5 pestañas (Forecast+Reportes fusionados en Analítica), Quick-Add global, próxima actividad en Kanban, contacto rápido en oportunidad y timeline en lead.",
    description: "CrmLayout reducido + Configuración como icono; Analitica.tsx con sub-tabs Forecast/Embudo/Pérdidas/Vendedores; Dashboard renombrado Inicio y reordenado; QuickAddMenu (lead/oportunidad/actividad); NuevaActividadDialog; ActividadTimeline en LeadDetalle; OportunidadDetalle con tabs Resumen/Comunicación/Trazabilidad y ContactActions con plantillas; useProximasActividades batch; Kanban muestra próxima acción por card. APP_VERSION 11.7.0.",
  },
  {
    version: "11.6.0",
    date: "2026-05-25",
    type: "minor",
    title: "CRM Sprint D: integración comercial y vista 360° del cliente",
    summary: "Cotizaciones y comentarios en oportunidad, tab CRM en ClienteDetalle, valor real al ganar y leaderboard de vendedores.",
    description: "Migración valor_real en crm_oportunidades + tabla crm_comentarios_oportunidad con RLS y triggers (registra valor real al aceptar cotización ligada; notifica al vendedor cuando otro usuario comenta). Hooks useComentariosOportunidad y useCliente360. Componentes ComentariosOportunidad, OportunidadCotizacionesList, LeaderboardVendedores y Cliente360Panel. OportunidadDetalle muestra valor real, cotizaciones vinculadas y comentarios; al crear cotización mueve la oportunidad a 'Cotizando'. ClienteDetalle suma tab CRM. Reportes incluye leaderboard mensual con cuota vs. cerrado. APP_VERSION 11.6.0.",
  },
  {
    version: "11.5.0",
    date: "2026-05-25",
    type: "minor",
    title: "CRM Sprint C: automatizaciones, notificaciones y plantillas",
    summary: "Tareas automáticas al cambiar etapa, notificaciones in-app, plantillas de email/WhatsApp, banner de vencidas y auto-creación de actividad inicial.",
    description: "Migración crm_etapas_pipeline.crea_tarea_seguimiento + dias_seguimiento; tablas crm_notificaciones y crm_plantillas_mensaje con RLS. Hooks useAutomatizacionesEtapa, useCrmNotificaciones, usePlantillasMensaje, useActividadesVencidasList. UI: CrmNotificacionesBell, EtapasPipelineEditor con tarea+días, tab Plantillas en /crm/configuracion, PlantillaSelector en ContactActions con variables, banner de vencidas en dashboard → /crm/actividades?filtro=vencidas, checkbox 'Crear actividad de seguimiento' en alta de leads y oportunidades. APP_VERSION 11.5.0.",
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
