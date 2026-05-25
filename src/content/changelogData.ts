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
    version: "11.19.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría loop 7 — App.tsx, barriles services y libs >200 LOC",
    summary: "App.tsx (265→43), services/crm (228→9 barrel), services/embarque/queries/listado (223→17), services/auditoria (205→11), lib/formatters (243→6), lib/parsers/dashboard, lib/domain/proyeccionFacturacion, lib/csv/importSchemas, useNuevoEmbarqueWizard (230→139), useHallazgosTablaState (213→158).",
    description: "Power of 10 — todos los archivos del proyecto bajo 200 LOC. App.tsx → routes.tsx + lib/queryClient.ts. services/crm/index.ts → oportunidadCotizaciones+lineage+leaderboard+cotizacionDesdeOportunidad. services/embarque/queries/listado.ts → paginados+exportListado+extras. services/auditoria/index.ts → reporte+revisiones+comentarios+snooze+snapshots. lib/formatters/index.ts → numbers+dates+text+phone+places. lib/parsers/dashboard.ts → dashboardTypes. lib/domain/proyeccionFacturacion.ts → types+conversion+agrupar+kpis+meses. lib/csv/importSchemas.ts → importSchemasShared+importSchemaCliente+importSchemaProveedor. useNuevoEmbarqueWizard.ts → useNuevoEmbarqueExpediente + useNuevoEmbarqueCotVinculada. useHallazgosTablaState.ts → hallazgosTablaFilters. Sin cambios funcionales — todos los barrels preservan API pública. 626 tests verdes. APP_VERSION 11.19.0.",
  },
  {
    version: "11.17.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría loop 5 — componentes >200 LOC: TabDocumentos, BitacoraActividad, Facturacion, DashboardStatusCards",
    summary: "TabDocumentos (257→81), BitacoraActividad (253→47), Facturacion (242→117), DashboardStatusCards (230→24). Subcomponentes y columns extraídos.",
    description: "Power of 10: TabDocumentos.tsx → AgregarDocumentoDialog + useDocumentoColumns. BitacoraActividad.tsx → bitacora/{constants,FilaEntrada,VirtualTimeline}. Facturacion.tsx → facturacionColumns.tsx (facturaColumns + buildGastoColumns). DashboardStatusCards.tsx → statusCards/{TimelineEstadosCard,ArribosCard}. Sin cambios funcionales. APP_VERSION 11.17.0.",
  },
  {
    version: "11.16.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría loop 4 — componentes >200 LOC",
    summary: "LeadDetalle (296→150), NuevaOportunidadDialog (287→132), DiagnosticoHealthPanel (258→96).",
    description: "Power of 10: componentes >200. LeadDetalle.tsx → useLeadEditForm + LeadDatosCard + LeadHeaderActions. NuevaOportunidadDialog.tsx → useOportunidadForm + OportunidadFormFields. DiagnosticoHealthPanel.tsx → HealthKpisRow/HealthTimelineChart/HealthTopErrorsChart/HealthSlowestTable. Sin cambios funcionales. 91 archivos / 626 tests verdes. APP_VERSION 11.16.0.",
  },
  {
    version: "11.15.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría loop 3 — hooks JSONCargo, dashboard CRM y tracking live <200 LOC",
    summary: "useJsonCargoTracking (250→110), useCrmDashboard (213→170), useTrackingLiveCard (209→100). Lógica pura extraída + 17 tests nuevos.",
    description: "Power of 10: useJsonCargoTracking (250) → 110 con extractSummary y PrefixMismatchError en lib/jsoncargo/summary.ts; buildFechasUpdate/shouldAvanzarArribo/registrarEventoArribo en services/embarque/jsoncargoFechas.ts. useCrmDashboard (213→170) con computePipelinePonderado/computeTopDeals/computeEmbudo en lib/crm/dashboardAggregates.ts. useTrackingLiveCard (209→100) con jsoncargoDateToYmd/computeFechasPropuestas/derivePrefixState/buildApplyFechasArgs/handleSyncResult/handleSyncError en lib/jsoncargo/trackingLiveHelpers.ts. Re-exports preservan API pública en los 3 hooks. 3 archivos de tests nuevos (17 casos). Suite verde. APP_VERSION 11.15.0.",
  },
  {
    version: "11.14.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría loop 2 — split useAuditoriaRevisiones + extracción de helpers puros",
    summary: "useAuditoriaRevisiones (259) → barrel de 11 líneas; useAuditoriaEjecutivo (256→94); useEmbarquesPageState (256→178); useNuevoEmbarqueWizard (260→230). +3 archivos de tests.",
    description: "useAuditoriaRevisiones.ts (259) dividido en revisiones/{hash,query,marcar,desmarcar,asignar}.ts; barrel preserva API. lib/auditoria/ejecutivoAgregados.ts (182 líneas) extraído de useAuditoriaEjecutivo (256→94). lib/embarque/embarquesPageHelpers.ts (105) extraído de useEmbarquesPageState (256→178). lib/domain/embarqueWizardStepValidator.ts (59) extraído de useNuevoEmbarqueWizard (260→230). 3 tests nuevos (15 casos): ejecutivoAgregados, embarquesPageHelpers, embarqueWizardStepValidator. Suite: 85 archivos / 592 tests verdes. APP_VERSION 11.14.0.",
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
