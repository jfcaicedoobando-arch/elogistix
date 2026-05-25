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
    version: "11.28.0",
    date: "2026-05-25",
    type: "minor",
    title: "Eliminación de eslint-disable (parte 3/3): 0 directivas restantes",
    summary: "Removidas las 9 últimas (9→0): no-explicit-any×4, complexity×3, react-refresh×1, + override test files. Causa raíz aplicada (tipos genéricos, stripUndefined, subcomponentes).",
    description: "Tercera y última tanda del plan. (1) no-explicit-any: appFeedback.AnyToastFn → Record<string, unknown>; useNuevoEmbarqueExpediente ahora es genérico <TForm extends FieldValues> y aísla el cast a setValue('blMaster',…) en un setter local; exportListado.applyFilters tipa el builder vía QueryLike (interfaz mínima con eq/or/gte/lte) en lugar de any; embarqueRoundtrip.test usa Parameters<typeof mapEmbarqueRowToFormValues>[0] como cast tipado. (2) complexity: leadPayload y oportunidadPayload eliminan la cadena de `??` aplicando defaults + stripUndefined() vía spread (con `as const` para preservar literales de enums); VirtualDataTable mueve el destructuring de defaults a withDefaults(props) helper. (3) react-refresh: DataTable.tsx allowlisted en eslint.config.js (mismo patrón que src/components/ui/**). (4) SentryDiagnostico dividido en RuntimeCard + UsuarioCard + OrganizacionCard + PipelineCard. (5) eslint.config.js: override de tests añade no-explicit-any: off (casts en fixtures parciales son legítimos). Resultado: 0 eslint-disable en src/, 626 tests verdes, tsc limpio. APP_VERSION 11.28.0.",
  },
  {
    version: "11.27.0",
    date: "2026-05-25",
    type: "minor",
    title: "Eliminación de eslint-disable (parte 2): exhaustive-deps complejos",
    summary: "10 directivas más removidas (19→9): useEditarEmbarqueWizard×4, useListPageState, useCotizacionWizardSteps, VirtualDataTable — fixes por causa raíz (useCallback estable, useRef snapshot, widthsKey derivado).",
    description: "Segunda tanda del plan. (1) useConceptosForm.inicializarVenta/Costo → useCallback, lo que permite añadirlos como deps en los 3 effects de hidratación de useEditarEmbarqueWizard + el 4° effect declara methods. (2) useListPageState: defaultFilters capturado vía useRef al montar (snapshot inmutable). (3) useCotizacionWizardSteps: handlePaso1/2/3 envueltos en useCallback con sus deps reales; handleSiguiente depende sólo de currentStep + los 3 callbacks. (4) VirtualDataTable: gridTemplate se deriva directamente de widthsKey (split/join con sentinel \\u0001), eliminando captura de leafColumns inestable. 626 tests verdes. APP_VERSION 11.27.0.",
  },
  {
    version: "11.26.0",
    date: "2026-05-25",
    type: "minor",
    title: "Eliminación de eslint-disable (parte 1/2): 11 directivas removidas",
    summary: "Tests (no-console, no-control-regex) movidos a override de config; Dimensiones*/EmbarquesRelacionadosCard a allowlist; exhaustive-deps corregidos en AuthContext, EditarEmbarque, DialogBolContainers, useAuditoriaSnapshots, useEmbarqueEstadoActions, usePortalEmbarquesController.",
    description: "Primera tanda del plan de limpieza de eslint-disable (30→19). (1) eslint.config.js: nuevo override para **/*.test.{ts,tsx} con no-console y no-control-regex en off (justifica perf logs + tests de sanitización). Allowlist de tablas extendida con DimensionesLCLTable, DimensionesAereasTable y EmbarquesRelacionadosCard. (2) Causa raíz aplicada en deps: AuthContext.signOut envuelto en useCallback estable; EditarEmbarque incluye setCurrentStep en deps; useDialogBolContainers memoiza reset con useCallback y DialogBolContainers lo declara dep; useAuditoriaSnapshots desestructura mutate (estable); useEmbarqueEstadoActions captura las 6 primitivas de embarque + syncEstado.mutate; usePortalEmbarquesController usa setState funcional para evitar dep faltante. Pendiente loop 2: useEditarEmbarqueWizard×4, useListPageState, useCotizacionWizardSteps, VirtualDataTable, no-explicit-any×4, complexity×5, DataTable.tsx barrel. 626 tests verdes. APP_VERSION 11.26.0.",
  },
  {
    version: "11.25.0",
    date: "2026-05-25",
    type: "minor",
    title: "Spreads de queryKeys promovidos a factory methods",
    summary: "15 spreads `[...queryKeys.X, …]` eliminados; factory expone métodos tipados (embarques.full, dashboard.statsSummary, clientes.selectByOrg, etc.).",
    description: "Cierre de la centralización de query keys: nuevos métodos en lib/query/index.ts (embarques.{full, fullForEstadoFilter, extrasBranchB, expedientesCliente}, dashboard.{statsSummary, statsDetails}, clientes.selectByOrg, proveedores.selectByOrg, facturas.byOrg, cotizaciones.{byOrg, aceptadas}, admin.{organizationsStats, allUsersOptions, recentOrgsList}). Migrados consumidores en hooks/embarque, hooks/dashboard, hooks/cliente, hooks/cotizacion, hooks/facturacion y hooks/admin. 0 spreads de queryKeys fuera de lib/query. 626 tests verdes. APP_VERSION 11.25.0.",
  },
  {
    version: "11.24.0",
    date: "2026-05-25",
    type: "minor",
    title: "Centralización de query keys (P2)",
    summary: "110 literales queryKey migrados a factories en lib/query (crm, auditoria, appLogs, facturacion, misc).",
    description: "queryKeys ampliado con dominios crm/auditoria/appLogs/facturacion/misc. 44 archivos migrados (hooks/crm, hooks/auditoria, hooks/admin/logs, hooks/facturacion, hooks/embarque/useJsonCargoTracking, pages Papelera/Idempotencia/TrackingPublico/PdfPreviewCotizacion). Invalidaciones usan el prefijo más amplio (queryKeys.crm.X.all, dashboardAll). 0 strings hardcodeados de queryKey fuera de lib/query. 626 tests verdes. APP_VERSION 11.24.0.",
  },
  {
    version: "11.23.0",
    date: "2026-05-25",
    type: "minor",
    title: "P1.6 — Split de god services (cotización + facturas)",
    summary: "3 services divididos en subcarpetas (mutations/{crear,update,delete,estado}; proyeccion/{fetchSources,buildFilas}; huecoFacturacion/{fetchSources,buildFilas}). API pública intacta.",
    description: "Refactor estructural sin cambio de comportamiento. services/cotizacion/mutations.ts (137) → mutations/ con una operación por archivo + payloadBuilders puros. services/facturas/proyeccion.ts (111) y huecoFacturacion.ts (165) → carpetas con fetchSources (I/O Supabase) + buildFilas (agregaciones puras) + index (orquestador). Mismo patrón que services/embarque/. Imports históricos siguen funcionando vía resolución a index.ts. 626 tests verdes. APP_VERSION 11.23.0.",
  },
  {
    version: "11.22.1",
    date: "2026-05-25",
    type: "patch",
    title: "Perf tests estabilizados para CI",
    summary: "DataTable.perf.test.tsx con warmup + mediana de N corridas + umbrales relativos. 0 flakes en 5 corridas consecutivas.",
    description: "Helper measureMedian ejecuta 1 warmup + N mediciones con cleanup() y tryGc() entre cada una. Umbrales: ceiling absoluto generoso + linealidad relativa (5k ≤ baseline1k×8, 10k ≤ baseline1k×15) + rerenders ≤50-60% del mount. Mantiene capacidad de detectar regresiones reales (O(n²), pérdida de memo). 626 tests verdes. APP_VERSION 11.22.1.",
  },
  {
    version: "11.22.0",
    date: "2026-05-25",
    type: "patch",
    title: "Auditoría loop 10 — ESLint a 0 warnings",
    summary: "Resueltos 3 react-refresh/only-export-components, 1 no-empty-object-type y 5 unused-disable. ESLint queda en 0 warnings/errors.",
    description: "Extraídos a archivos dedicados: oportunidadesFiltersTypes.ts (FILTROS_DEFAULT + OportunidadesFiltros tipos) y proveedorTableColumns.tsx (proveedorColumns). columnMeta.ts: ColumnMeta declara marker readonly opcional para evitar interface vacía. DataTable.tsx mantiene re-export de defineColumns con disable acotado a esa línea. Logger y DataTable.perf.test: removidos eslint-disable obsoletos. 626 tests verdes. APP_VERSION 11.22.0.",
  },
  {
    version: "11.21.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría loop 9 — complexity warnings y exhaustive-deps",
    summary: "Complexity warnings 14→3 (3 mappers planos con disable inline). 2 exhaustive-deps en Leads/Oportunidades resueltos con useMemo.",
    description: "Refactors puros sin cambio de comportamiento. Helpers extraídos: buildLeadInsertPayload, buildOportunidadInsertPayload, buildFromOportunidad/buildEmptyForNueva, isLeadDirty, extractErrorDetails + fmt* helpers, parseEmbarqueConProfitRaw + numOr0/numOrCompute/safeMargen, forecastBuckets (classifyEtapa/makeBucket/applyDelta), buildAuthSnapshot/buildSentryUserContext, useSentryInfo + maskDsn, useCrmInicioVM. useMemo en data?.data de Leads y Oportunidades para estabilizar deps. Barrel nuevo hooks/sentry. APP_VERSION 11.21.0.",
  },
  {
    version: "11.20.0",
    date: "2026-05-25",
    type: "minor",
    title: "Auditoría loop 8 — barrel violations (0) y complejidad ciclomática",
    summary: "no-restricted-imports: 53→0. Barrel hooks/crm/index.ts. Complejidad reducida: OportunidadDetalle (33→<15), CrmDashboard (27→<15), useAutomatizacionesEtapa (26→<15), useConvertirLead (27→<15).",
    description: "P0.1 cerrado: creado src/hooks/crm/index.ts y reemplazados 53 imports a archivos internos por imports al barrel del dominio (53→0). P0.3 (mappers) actualizado: los archivos originalmente reportados ya estaban bajo 200 LOC; el verdadero hot spot eran 4 funciones con complejidad >25. Refactor: OportunidadDetalle.tsx dividido en guard + OportunidadDetalleContent + OportunidadKpisCards + DatosComercialesCard + ContactoRapidoCard + useOportunidadDetalleActions. CrmDashboard.tsx → VencidasAlert + ActividadesHoyCard + CerrandoSemanaCard + LeadsSinContactarCard + TopDealsCard. useAutomatizacionesEtapa.ts → automatizacionesEtapaActions (notifyVendedorMovido, crearTareaGanada, cancelarActividadesPerdida, crearTareaSeguimiento). useConvertirLead.ts → convertirHelpers (resolveClienteForConversion, fetchPrimeraEtapaAbierta). 626 tests verdes. APP_VERSION 11.20.0.",
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
