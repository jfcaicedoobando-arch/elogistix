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
    version: "11.2.0",
    date: "2026-05-25",
    type: "minor",
    title: "CRM Fases 3-6: Oportunidades, Actividades, Forecast y Reportes",
    summary: "Kanban con drag&drop, timeline de actividades, forecast ponderado, reportes y conversión de oportunidad a cotización.",
    description: "Hooks useOportunidades/useEtapasPipeline/useActividades/useForecastReportes. UI OportunidadKanban (@dnd-kit), ActividadTimeline, NuevaOportunidadDialog. Pantallas /crm/oportunidades (Kanban/Tabla), /crm/oportunidades/:id (con 'Crear cotización' que enlaza oportunidad_id), /crm/actividades, /crm/forecast, /crm/reportes. Vendedor: sidebar enfocada (CRM + Clientes + Ayuda). APP_VERSION 11.2.0.",
  },
  {
    version: "11.1.0",
    date: "2026-05-25",
    type: "minor",
    title: "CRM Fase 2: CRUD de Leads y conversión",
    summary: "Listado, alta, edición y eliminación de leads, con conversión opcional a cliente + oportunidad inicial.",
    description: "Nuevos hooks src/hooks/crm/useLeads.ts (paginación servidor, filtros estado/fuente, crear/actualizar/eliminar/convertir). Pantallas /crm/leads y /crm/leads/:id; diálogos NuevoLeadDialog y ConvertirLeadDialog (crea cliente opcional + oportunidad en la primera etapa abierta, marca lead como Convertido). Sidebar CRM agrega 'Leads'. APP_VERSION 11.1.0.",
  },
  {
    version: "11.0.0",
    date: "2026-05-25",
    type: "major",
    title: "Módulo CRM nativo — Fase 1: fundación",
    summary: "Base de datos del nuevo módulo CRM (leads, oportunidades, actividades, etapas configurables, motivos de pérdida, cuotas), nuevo rol 'vendedor', sidebar y dashboard.",
    description: "Migraciones: nuevo rol 'vendedor' en app_role; tablas crm_etapas_pipeline, crm_motivos_perdida, crm_leads, crm_oportunidades, crm_actividades (polimórfica), crm_cuotas_vendedor con RLS multi-tenant y soft-delete. Vendedor ve sólo lo suyo; admin/operador/super_admin ven todo de su organización. cotizaciones.oportunidad_id + trigger que marca la oportunidad como ganada al aceptar la cotización vinculada. Seed de 5 etapas y 6 motivos default por organización. Nueva sección CRM en sidebar y dashboard /crm con KPIs base. Fases 2-6 pendientes. APP_VERSION 11.0.0.",
  },
  {
    version: "10.2.5",
    date: "2026-05-25",
    type: "minor",
    title: "Pantalla de diagnóstico de Sentry",
    summary: "Nueva ruta /sentry que muestra el estado del SDK, release, environment, DSN enmascarado, usuario y organización, con botones para enviar un error/mensaje de prueba.",
    description: "src/pages/dashboard/SentryDiagnostico.tsx lee Sentry.getClient().getOptions() y combina con useAuth/useOrganization para mostrar el contexto real con el que viajan los reportes. Se agregó la ruta en App.tsx y el item 'Sentry' (icono Bug) en SIDEBAR_SISTEMA_ITEMS. APP_VERSION 10.2.5.",
  },
  {
    version: "10.2.4",
    date: "2026-05-25",
    type: "patch",
    title: "Fix validateDOMNesting en HallazgoSummary",
    summary: "Se reemplazó DialogDescription por <div> para evitar el warning de div dentro de <p> en el diálogo de marcar revisado.",
    description: "src/components/auditoria/marcarRevisado/HallazgoSummary.tsx: DialogDescription (renderiza como <p> por defecto) contenía <div> internos, lo que generaba el warning validateDOMNesting de React. Se cambió el wrapper a <div className='text-xs space-y-1 pt-1 text-muted-foreground'> y se eliminó el import de DialogDescription. APP_VERSION 10.2.4.",
  },
  {
    version: "10.2.3",
    date: "2026-05-25",
    type: "patch",
    title: "ErrorBoundary conectado a Sentry",
    summary: "Los errores atrapados por ErrorBoundary ahora también se reportan a Sentry con componentStack como contexto.",
    description: "src/components/shared/ErrorBoundary.tsx agrega Sentry.withScope + captureException (tag source=react-error-boundary, context react.componentStack) además del logClientError a app_logs. APP_VERSION 10.2.3.",
  },
  {
    version: "10.2.2",
    date: "2026-05-19",
    type: "patch",
    title: "Auditoría — 'Marcar revisado' deja de fallar con 'Sesión no válida'",
    summary: "useAuthSession hidrata user+session en INITIAL_SESSION; las mutaciones de auditoría caen a supabase.auth.getUser() si el contexto aún no rerenderó. Adiós a la carrera de hidratación.",
    description: "INITIAL_SESSION dejó de tratarse como refresh silencioso (sólo TOKEN_REFRESHED lo es). Nuevo helper resolveAuthUser() en useMarcarRevisado/useDesmarcarRevisado/useAsignarResponsable cae a la sesión real de Supabase si el user del contexto está null. 406/406 tests verdes. APP_VERSION 10.2.2.",
  },
  {
    version: "10.2.0",
    date: "2026-05-19",
    type: "minor",
    title: "PDFs migrados a @react-pdf/renderer (Document/Page/View/Text)",
    summary: "Cotización, Proforma (normal + consolidada) y Rentabilidad ahora se generan como PDFs binarios con @react-pdf/renderer + StyleSheet centralizado. Adiós a window.print(); nueva ruta /dev/pdf-preview/cotizacion/:id con PDFViewer.",
    description: "Nuevo paquete src/pdf/ (theme/styles, components Flexbox, documents y render). Adaptadores en src/generators/*Pdf.tsx preservan las firmas — CotizacionDetalle, useDescargarProformaPdf, useDialogGenerarProformaController y useReportesPageController no requieren cambios. Helpers HTML legacy eliminados (pdfShell, dimensiones, proforma/{styles,header,consolidada}). APP_VERSION 10.2.0.",
  },
  {
    version: "10.1.4",
    date: "2026-05-19",
    type: "patch",
    title: "Aritmética financiera migrada a currency.js",
    summary: "financialUtils, profitUtils y costosUSD ahora usan currency.js para toda la aritmética monetaria, eliminando errores de punto flotante sin tocar firmas ni consumidores.",
    description: "Se reemplazaron los operadores nativos (+, -, *, /) por currency().add/.subtract/.multiply/.divide en los tres módulos financieros centrales. Sin Math.round ni toFixed: el redondeo lo maneja currency.js (precision:2 para montos, precision:4 para el % de margen). Firmas y tipos exportados intactos. 43/43 tests verdes. APP_VERSION 10.1.4.",
  },
  {
    version: "10.1.3",
    date: "2026-05-19",
    type: "patch",
    title: "Cierre del refactor a TanStack: limpieza de JSDoc legacy + resumen step-by-step",
    summary: "JSDoc de DataTable.tsx, useTableInstance.ts, columnMeta.ts, sortingFns.ts y embarqueColumns.tsx ya no citan símbolos eliminados. Nuevo docs/refactor-tanstack-summary.md con la bitácora completa del refactor.",
    description: "Cierre formal del refactor de tablas a @tanstack/react-table + @tanstack/react-virtual. Limpieza de comentarios obsoletos, nuevo documento step-by-step en 8 pasos (adapter intermedio → migración total → virtualización → integración Supabase → tests) y verificación de que no queden menciones legacy ni reordenamientos manuales en componentes de tabla. Sin cambios de runtime, comportamiento ni UI. APP_VERSION 10.1.3.",
  },
  {
    version: "10.1.2",
    date: "2026-05-19",
    type: "patch",
    title: "Auditoría de rendimiento de DataTable/VirtualDataTable",
    summary: "Nuevos benchmarks (DataTable.perf.test.tsx) y reporte docs/datatable-perf-audit.md. 10k filas montan en 124ms; rerender de 5k con data estable en 1.7ms.",
    description: "6 benchmarks automatizados con presupuestos: DataTable 50 filas (73ms), VirtualDataTable 1k/5k/10k (20/74/124ms, escalado sublinear) y rerender 5k con data por referencia (1.7ms). El reporte confirma que la memoización introducida en 9.1.3 sigue trabajando y documenta las invariantes que no deben romperse. Sin cambios de código. APP_VERSION 10.1.2.",
  },
  {
    version: "10.1.1",
    date: "2026-05-19",
    type: "patch",
    title: "Guía de autoría de tablas — ColumnDef nativo documentada",
    summary: "Nueva docs/datatable-columndef-guide.md con la receta canónica (defineColumns + sortingFns + meta), mapeo desde la API legacy, anti-patrones y checklist de PR.",
    description: "Contrato único para futuras tablas a partir de 10.0.0. Incluye receta TL;DR, reglas server-side, mapeo 1:1 desde DataTableColumn, 8 anti-patrones a rechazar en review, tests mínimos y checklist de PR. Sin cambios de código ni UI. APP_VERSION 10.1.1.",
  },
  {
    version: "10.1.0",
    date: "2026-05-19",
    type: "minor",
    title: "Pruebas E2E de DataTable: filtros, orden y paginación",
    summary: "Nueva suite DataTable.e2e.test.tsx (10 pruebas) que valida el flujo completo de filtrado externo, ciclo de orden, paginación controlada y virtualización. 26/26 verdes.",
    description: "Se agregó src/components/shared/dataTable/__tests__/DataTable.e2e.test.tsx con un harness <EmbarquesHarness/> que reproduce el patrón real: filtro + DataTable server-sort + paginación controlada. Cubre: filtro que resetea a página 0, Siguiente avanza la franja, header dispara onSortChange con id nativo, ciclo asc→desc→null, respeto del orden server-side, empty state, isLoading, y montaje del rowModel virtualizado. Sin cambios funcionales ni de UI. APP_VERSION 10.1.0.",
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
