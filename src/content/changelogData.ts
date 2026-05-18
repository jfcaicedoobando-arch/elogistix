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
    version: "8.204.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 8 (cierre: 0 warnings ESLint)",
    summary: "8 → 0 warnings ESLint. useTrackingLiveCard, buildGlobal, useCotizacionWizardSteps, usePortalEmbarquesController, BulkImportDialog y auditoria-weekly-digest cerrados.",
    description: "Refactors puros sin cambios funcionales ni de BD. useTrackingLiveCard (19→0) extrae derivePrefixState, handleSyncResult, handleSyncError, buildApplyFechasArgs. useOperacionesData buildGlobal (17→0) extraída del hook con helper n(). useCotizacionWizardSteps handleSiguiente (18→0) divide en handlePaso1/2/3. usePortalEmbarquesController filtered (17→0) extrae embarqueMatchesSearch. BulkImportDialog (273→<200 LOC) mueve UploadStep/PreviewStep a BulkImportSteps.tsx. DimensionesAereasTable/LCLTable: allowlist documentada para Table primitivo (read-only). auditoria-weekly-digest (17→0) extrae resolveAdminEmails/sendDigest/processOrg/unauthorized y tipa con SupabaseClient. 369/369 tests verdes. APP_VERSION 8.204.0.",
  },
  {
    version: "8.203.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 7 (DatosGenerales, Mercancía, Sidebar, BulkImport, proformaPdf)",
    summary: "14 → ~7 warnings ESLint. buildRows, SeccionMercanciaCotizacionDetalle, AppSidebarBase, BulkImportDialog, VirtualDataTable, TrackingWarnings y useCotizacionWizardSteps refactorizados.",
    description: "Refactors puros sin cambios funcionales ni de BD. CotizacionDatosGeneralesCard divide buildRows en baseRows/optionalRows/maritimeRows/seguroRow. SeccionMercanciaCotizacionDetalle extrae MercanciaInfoGrid + DimensionesLCL/AereasTable. ConceptoRowUSD extrae ConceptoDescripcionSelector. TrackingWarnings usa computeAlertFlags. AppSidebar usa useAppSidebarSections + barrel hooks/layout. BulkImportDialog y VirtualDataTable extraen body/footer sub-componentes. proformaPdf dividido en proforma/{styles,header,consolidada}.ts (271→<150 LOC). embarqueWizardSchemas dividido en Constants/Documentos/Costos (257→<200 LOC). useCotizacionWizardSteps simplifica handleSiguiente con validatePaso1 puro. 369/369 tests verdes. APP_VERSION 8.203.0.",
  },
  {
    version: "8.202.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 6 (jsoncargo-track, invite-client-user, TrackingWarnings, proformaPdf)",
    summary: "21 → 14 warnings ESLint. jsoncargo-track, invite-client-user, deriveEventsFromContainer, TrackingWarnings, CotizacionDatosGeneralesCard, buildHeaderHtml y VirtualDataTable refactorizados.",
    description: "Refactors puros sin cambios funcionales ni de BD. jsoncargo-track extrae helpers a _shared/jsoncargoSync.ts. invite-client-user (26→0) extrae parseBody, verifyClienteOrg, resolveUserId, ensureClienteRole. _shared/jsoncargo.ts deriveEventsFromContainer (22→0) dividido en buildZarpe/Movimiento/AduanaEvent. TrackingWarnings.tsx (23→0) extrae 4 sub-componentes de alerta. CotizacionDatosGeneralesCard.tsx (24→0) usa array declarativo. proformaPdf buildHeaderHtml (21→0) extrae sub-secciones. VirtualDataTable extrae VirtualRow, VirtualHeaderRow, SkeletonRows, EmptyState. BulkImportDialog extrae hook useBulkImport. APP_VERSION 8.202.0.",
  },
  {
    version: "8.201.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 5 (filtros embarques, hallazgos, edge functions)",
    summary: "30 → 21 warnings ESLint. useEmbarquesPageState, matchBase, create-user, tracking-public y parse-csf refactorizados con helpers puros.",
    description: "P2.12 Lote 5 — Refactors puros sin cambios funcionales: hooks/embarque/useEmbarquesPageState.ts (26→0) extrae useEmbarquesFilters (estado nuqs + debounce), computeCounts, resolveExtras y buildFullSetFilters; compareBy usa lookup SORT_GETTERS. hooks/auditoria/useHallazgosTablaState.ts (17/16→0) reemplaza matchBase por BASE_PREDICATES tabulares. scripts/audit-casts.ts (17→0, +unused-disable) divide classify. supabase/functions/create-user (17→0), tracking-public (18→0) y parse-csf (20→0) extraen validatePayload, loadLink/loadEmbarqueData, validateFile/handleGatewayError/callAiGateway/processCsf. 369/369 tests verdes. APP_VERSION 8.201.0.",
  },
  {
    version: "8.200.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 4 (cotizacionPdf, StepDatosRuta, TabResumen, EmbarquesEstadoDialog)",
    summary: "23 → 20 warnings ESLint. generarPdfCotizacion (46→0), StepDatosRuta (25→0), TabResumen (24→0) y EmbarquesEstadoDialog (26→0) partidos en sub-helpers y sub-componentes.",
    description: "P2.12 Lote 4 — Refactors puros sin cambios funcionales. generators/cotizacionPdf.ts: extraído a generators/cotizacion/{datosGenerales,dimensiones,conceptosTables,pdfShell}.ts (orquestador queda <50 LOC; rowsMaritimo/rowsOpcionales aíslan ramas; buildUsdTable usa rowUsdConIva/rowUsdSinIva). components/embarque/StepDatosRuta.tsx: dispatcher delgado + sub-componentes por modalidad (StepDatosRutaMaritimo/Aereo/Terrestre/Fechas). components/embarque/TabResumen.tsx: extrae EstadoProgresoCard, DatosGeneralesCard, RutaTransporteCard, EmbarquesRelacionadosCard, FechaConOriginal a tabResumen/. components/operaciones/EmbarquesEstadoDialog.tsx: extrae EmbarqueEstadoListItem + helpers calcularExtra/toneClass/subtituloPartes/rutaTexto. 369/369 tests verdes. APP_VERSION 8.200.0.",
  },
  {
    version: "8.198.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 endurecimiento de complejidad",
    summary: "30 → 26 warnings ESLint. validateStepRuta/Costos, diffConceptos, agruparPorExpediente y useEmbarqueDetalleData refactorizados con helpers extraídos.",
    description: "P2.12 Endurecimiento de complejidad ciclomática (post P2.10). Refactors puros, sin cambios funcionales: lib/domain/embarqueWizardSchemas.ts — validateStepRuta (28→0) extrae validateMaritimoRuta/Aereo/Terrestre y validateRutaModo; validateStepCostos (16→0) extrae parseTC, validarConceptosVenta y validarConceptosCosto. lib/audit/diffFields.ts — diffConceptos (17→0) extrae nombreOf y compararConcepto. lib/domain/proyeccionFacturacion.ts — agruparPorExpediente (19→0) extrae initGrupo y mergeFila. hooks/embarque/useEmbarqueDetalleData.ts (17→0) usa helpers tc() y pick() para tipos de cambio y defaults `?? []`. 369/369 tests verdes. APP_VERSION 8.198.0.",
  },
  {
    version: "8.197.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.10 + cierre Sprint 3",
    summary: "useToast/useIsMobile re-exportados desde hooks/shared para uniformidad. recentChangelog trimmed a 10 entradas (bundle).",
    description: "P2.10 Hooks compartidos: nuevos wrappers `hooks/shared/useToast.ts` y `hooks/shared/useIsMobile.ts` re-exportan los hooks canónicos shadcn (`@/hooks/use-toast`, `@/hooks/use-mobile`) bajo el barrel `hooks/shared`. Se conservan los módulos raíz por convención shadcn — los nuevos consumidores pueden importarlos desde el barrel. Mantenimiento: `recentChangelog` recortado de 11 a 10 entradas para mantener pequeño el chunk lazy (test `<= 10` pasa). 369/369 tests verdes. APP_VERSION 8.197.0.",
  },
  {
    version: "8.196.0",
    date: "2026-05-18",
    type: "minor",
    title: "Auditoría — P0.3 (pages) + P1.8 (tests de servicios)",
    summary: "43 → 41 warnings, 359 → 369 tests. TrackingPublico/Embarques/EmbarqueDetalle partidos en sub-componentes; nuevos hooks useTabsParam y useEmbarqueDetalleData.",
    description: "P0.3 Pages: TrackingPublico, Embarques y EmbarqueDetalle bajan a 0 warnings de complejidad extrayendo sub-componentes (TrackingPublicoTimeline, EmbarquesHeaderActions, LoadingState/NotFoundState) y hooks (useTabsParam genérico para query param, useEmbarqueDetalleData que centraliza defaults). P1.8 Tests: nuevas suites para navieras mapper (5), embarqueRoundtrip (3) y cotizacionPaso1 (3). 369/369 verdes. APP_VERSION 8.196.0.",
  },
  {
    version: "8.195.0",
    date: "2026-05-18",
    type: "minor",
    title: "Auditoría arquitectónica — P0.3, P1.5, P1.6, P2.11 cerrados",
    summary: "51 → 35 warnings ESLint. Mappers y servicios partidos en sub-helpers por sección, utils unificados, mapa de arquitectura documentado.",
    description: "P0.3 Mappers refactor: embarqueFromDb/ToDb, cotizacion y cotizacionForm divididos en helpers por sección con nuevo `lib/mappers/_helpers.ts` (str/num/bool/emptyToNull). jsoncargo/navieras usa tabla iterable en lugar de cadena de if. P1.6 Servicios: facturas/proyeccion, facturas/huecoFacturacion y cotizacion/mutations partidos en sub-funciones fetch/index/construir. P1.5 Utils: lib/utils.ts plano eliminado, todo bajo lib/utils/ con barrel. P2.11 Nuevo docs/architecture-map.md con mapa dominio → capas. 359/359 tests verdes. APP_VERSION 8.195.0.",
  },
  {
    version: "8.193.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría arquitectónica — P0.2 (Supabase fuera de pages/components)",
    summary: "Plan completo de auditoría documentado y primer paso implementado: 3 archivos UI que llamaban a Supabase directamente ahora pasan por servicios dedicados.",
    description: "Auditoría read-only del repo (637 archivos, 265 warnings ESLint, 0 errores) plasmada en .lovable/plan.md con plan priorizado de 4 sprints. Implementado P0.2: extraídas las llamadas Supabase directas de pages/components a la capa de servicio. Nuevos archivos: services/admin/papelera.ts (listTrash, restoreRecord, purgeRecord), services/admin/idempotencia.ts (listIdempotencyLog) y services/observability/{index,logClientError}.ts. Actualizados: pages/dashboard/Papelera.tsx, pages/dashboard/Idempotencia.tsx y components/shared/ErrorBoundary.tsx. Reducidas a 0 las llamadas directas a @/integrations/supabase/client desde components/pages (eran 3). 359/359 tests verdes. APP_VERSION 8.193.0.",
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
