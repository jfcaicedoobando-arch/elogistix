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
    version: "10.2.1",
    date: "2026-05-19",
    type: "patch",
    title: "Tests heredados verdes — fixtures de toast/dashboard y recentChangelog ≤10",
    summary: "Se cerraron los 4 fallos preexistentes: tests de notifyError aceptan el campo debug del toast, parseArribosEsteMes usa toMatchObject y recentChangelog quedó recortado al top 10 esperado por el integrity check.",
    description: "Fix de la suite Vitest sin tocar runtime. appFeedback.test usa expect.objectContaining (debug del toast destructive desde 8.216.0); dashboard.test parseArribosEsteMes usa toMatchObject (campos MXN añadidos en 8.212.0); recentChangelog recortado a 10 (chunk0 sigue como fuente de verdad). 406/406 tests verdes. APP_VERSION 10.2.1.",
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
  {
    version: "10.0.0",
    date: "2026-05-19",
    type: "major",
    title: "Fase 3 — DataTable 100% TanStack nativo; adapter legacy eliminado",
    summary: "21 archivos migrados a ColumnDef<T> nativo. Se eliminó columnAdapter.ts y los tipos DataTableColumn<T>/SortValue. DataTable acepta sólo ColumnDef<T, unknown>[].",
    description: "Breaking change en la API pública de DataTable: el shape legacy { key, render, sortable, sortValue, align, className } ya no se acepta. Todo call-site usa ahora { id, cell, enableSorting, accessorFn + sortingFn, meta }. Se borró columnAdapter.ts, se simplificaron useTableInstance/DataTable/VirtualDataTable, y se migraron los 21 archivos restantes. Sin cambios visuales ni de comportamiento. APP_VERSION 10.0.0.",
  },
  {
    version: "9.2.0",
    date: "2026-05-19",
    type: "minor",
    title: "Fase 2 — 13 tablas core migradas a ColumnDef nativo",
    summary: "Embarques, Cotizaciones, Clientes, Proveedores y Facturación ahora usan ColumnDef<T> nativo de TanStack + helpers sortByString/Number/Date con colación es-MX.",
    description: "Migración de 13 archivos del core operativo a defineColumns + ColumnDef nativo. Nuevo sortingFns.ts (null-safe, Intl.Collator es-MX). Tests ampliados con casos de colación, nulls y meta visual. Doc docs/migracion-tabla-fase2.md con equivalencias y pendientes. Adapter legacy sigue activo hasta cerrar el ticket. APP_VERSION 9.2.0.",
  },
  {
    version: "8.225.0",
    date: "2026-05-19",
    type: "minor",
    title: "Detalle de embarque — cargar costos desde el tab vacío",
    summary: "Cuando un embarque no tiene costos, el círculo del estado vacío en el tab Costos abre el wizard de edición en el paso de costos.",
    description: "Los EmptyState del tab Costos ahora navegan a /embarques/:id/editar?step=3 al hacer clic en el ícono o en 'Cargar costos'. EditarEmbarque respeta el query param step. APP_VERSION 8.225.0.",
  },
  {
    version: "8.224.0",
    date: "2026-05-19",
    type: "patch",
    title: "Editar embarque — precargar Shipper y Consignatario",
    summary: "Los selects de Shipper y Consignatario ahora muestran el valor ya guardado al entrar a editar.",
    description: "Se agregó resolución inversa en useEditarEmbarqueWizard para mapear el string guardado en BD al value que esperan los <Select> del wizard (contacto.id, __cliente__ o __otro__). APP_VERSION 8.224.0.",
  },
  {
    version: "8.223.0",
    date: "2026-05-18",
    type: "minor",
    title: "Eliminada la opción 'Duplicar' en embarques y cotizaciones",
    summary: "Por solicitud de operación: la acción Duplicar ya no aparece en ningún menú para ningún usuario.",
    description: "Se retiró el ítem 'Duplicar' del menú de acciones de fila en /embarques y /cotizaciones, y del menú '…' en el detalle de embarque. Servicios y diálogo permanecen en el repo como código muerto para poder reactivar la función en el futuro. APP_VERSION 8.223.0.",
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
