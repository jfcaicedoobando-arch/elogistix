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
    version: "8.118.2",
    date: "2026-05-06",
    type: "patch",
    title: "Refactor Sprint 1: Hueco de Facturación modularizado",
    summary: "Se separó el componente HuecoFacturacionCard en hook, columnas y dialog para alinearlo al patrón del resto del proyecto.",
    description: "Limpieza arquitectónica: nuevo hook useHuecoFacturacion (encapsula useQuery + CSV), columnas en huecoFacturacionColumns.tsx y dialog en HuecoFacturacionDetalleDialog.tsx. El card pasó de 260 a ~110 LOC sin cambios de UX.",
  },
  {
    version: "8.118.1",
    date: "2026-05-05",
    type: "patch",
    title: "Hueco de Facturación: descarga CSV con BL Master y House",
    summary: "El dialog de detalle del Hueco de Facturación ahora permite descargar un CSV con los embarques pendientes, incluyendo BL Master y BL House.",
    description: "El dialog 'Ver detalle' del Hueco de Facturación añade una columna BL (Master + House) y un botón 'Descargar CSV' en el footer. El CSV exporta Expediente, Cliente, Operador, ETD, ETA, BL Master, BL House, Días sin facturar, Venta USD y Venta MXN.",
  },
  {
    version: "8.118.0",
    date: "2026-05-05",
    type: "minor",
    title: "Proyección: nueva tarjeta 'Hueco de Facturación' (alerta global)",
    summary: "Tarjeta fija arriba de Pre-Facturación que muestra embarques con ETD > 5 días sin factura emitida, con totales en USD y MXN y dialog de detalle.",
    description: "Nueva tarjeta de alerta en la tab Proyección de /facturacion. Muestra embarques con ETD ≥ 1/abr/2026 y > 5 días desde ETD que todavía no tienen factura emitida al cliente (factura_pdf_url). Es FIJA arriba del selector de mes — indicador global. Muestra conteo de embarques, total sin facturar en USD y MXN, y botón 'Ver detalle' con dialog (expediente, cliente, operador, ETD, días sin facturar coloreados, Venta USD/MXN, click navega al embarque). Cuando no hay hueco, muestra versión success compacta.",
  },
  {
    version: "8.117.5",
    date: "2026-05-05",
    type: "minor",
    title: "Operaciones: drill-down de embarques por estado en cada operador",
    summary: "En cada tarjeta de operador, los conteos por estado ahora son clickeables y abren la lista detallada de embarques en ese estado.",
    description: "En /operaciones, cada renglón de estado dentro de la tarjeta de operador es ahora clickeable y abre un dialog con la lista de embarques (expediente, cliente, modo, ruta, ETD/ETA, días en puerto o días para ETA), búsqueda local y enlace al detalle. Botón 'Ver todos en Embarques' lleva al listado pre-filtrado por operador + estado. Backend: la RPC operaciones_stats incluye un nuevo campo embarquesPorEstado por operador, limitado a 200 ítems por estado (50 para Cerrado).",
  },
  {
    version: "8.117.4",
    date: "2026-05-05",
    type: "minor",
    title: "Proyección: rediseño 'Cierre mensual' con USD + MXN en 3 tarjetas",
    summary: "El resumen del mes ahora se presenta como un bloque 'CIERRE [Mes Año]' con tarjetas Facturado, Pendiente y Proyectado mostrando embarques + USD + MXN. La tabla añade columna Venta USD y el CSV exporta también los totales en USD.",
    description: "Rediseño visual de la tab Proyección en /facturacion para presentar el cierre mensual a socios. Nuevo bloque 'CIERRE [Mes Año]' con 3 tarjetas (Facturado, Pendiente, Proyectado) cada una con embarques + USD + MXN; Profit colorea verde/ámbar/rojo según margen y barra de progreso debajo. Tabla de detalle con nueva columna 'Venta USD'. CSV ampliado con Venta/Costo/Profit USD. Lógica de dominio extendida con sumarConceptosEnUsd; sin nuevas queries (USD se deriva con el TC propio de cada embarque). Versión 8.117.4.",
  },
  {
    version: "8.117.3",
    date: "2026-05-04",
    type: "patch",
    title: "Embarques: exportar CSV ahora trae el 100% de los registros filtrados",
    summary: "El export CSV en /embarques ya no se limita a la página visible: descarga todos los embarques que cumplen los filtros actuales (operador, cliente, modo, fechas, etc.).",
    description: "Bugfix en /embarques. Antes, 'Exportar CSV' solo exportaba la página actual (20 filas) y además aplicaba el dedupe por expediente, así que filtrar por un operador (ej. Valeria) y exportar devolvía solo lo visible. Ahora se hace una nueva fetch server-side sin paginar (fetchEmbarquesParaExport en src/services/embarque/queries.ts) que reaplica organizationId, search, modo, cliente, operador, proforma, fechaDesde y fechaHasta, paginando internamente en chunks de 1000 para superar el límite default de Supabase. Después se filtra por estado client-side (igual que la tabla) y se traen los estados de costos vía embarques_list_extras también en chunks de 1000 IDs. El botón muestra 'Exportando...' mientras corre y se notifica con toast cuántos embarques se exportaron. Se exportan TODOS los contenedores (sin dedupe por expediente) para reflejar 100% de las operaciones del operador filtrado. Versión 8.117.3.",
  },
  {
    version: "8.117.2",
    date: "2026-05-04",
    type: "patch",
    title: "Proyección: claridad de moneda MXN y foco en pendiente de facturar",
    summary: "Las tarjetas de resumen ahora muestran 'X de Y facturados', monto pendiente vs facturado y aclaran que todo está en MXN.",
    description: "Refactor de KPIs de la tab Proyección en /facturacion: (1) Tarjeta 1 'Embarques del mes' muestra 'X de Y facturados' con subtítulo 'Z pendientes de facturar' y barra de progreso. (2) Tarjeta 2 'Pendiente de facturar' enfocada en el monto que falta cobrar (tono warning, icono Clock). (3) Tarjeta 3 'Ya facturado' enfocada en lo cobrado (tono success). (4) Tarjeta 4 'Profit proyectado (MXN)' con tooltip Venta − Costo = Profit. (5) Columnas de la tabla renombradas a 'Venta (MXN)', 'Costo (MXN)', 'Profit (MXN)'. (6) Nota informativa debajo de los KPIs: 'Todos los montos se muestran en MXN. Los conceptos en USD/EUR se convierten al tipo de cambio del propio embarque'. (7) Filtro de estado: 'Pendiente de facturar' en lugar de 'Pendiente'. Se añadió ventaPendienteMxn a calcularKpisProyeccion. Versión 8.117.2.",
  },
  {
    version: "8.117.1",
    date: "2026-05-04",
    type: "patch",
    title: "Proyección: corrige estado 'Facturado' para proformas consolidadas",
    summary: "Cuando una proforma consolidada genera una factura para varios contenedores del mismo expediente, todos los embarques del expediente se marcan como Facturado.",
    description: "Bugfix en src/services/facturas/proyeccion.ts: la query de facturas ahora busca por expediente (con factura_pdf_url no nulo) en lugar de embarque_id. tiene_factura_pdf=true se asigna a cualquier embarque cuyo expediente esté en el set de expedientes facturados, alineando la regla con cómo se factura realmente.",
  },
  {
    version: "8.117.0",
    date: "2026-05-04",
    type: "minor",
    title: "Pre-Facturación: nueva tab 'Proyección' para cierre mensual por ETA",
    summary: "Vista mensual con KPIs de venta proyectada vs facturada, profit, avance %, tabla agrupada por expediente, filtros por cliente/operador/estado y export CSV.",
    description: "Nueva primera tab 'Proyección' en /facturacion: selector de mes (◀/▶ + Select, default mes actual, URL ?mes=YYYY-MM), 4 KPIs (expedientes, facturación facturada vs proyectada, profit con margen, avance % con barra), tabla agrupada por expediente con suma de venta/costo/profit y conteo de contenedores, filtros por cliente/operador/estado, export CSV. Estado 'Facturado' = tiene_proforma=true Y factura con factura_pdf_url; el grupo está Facturado solo si TODOS sus embarques cumplen. Montos convertidos a MXN con TC del embarque. 4 queries en paralelo, cache 60s, sin cambios de DB.",
  },
  {
    version: "8.116.0",
    date: "2026-05-04",
    type: "minor",
    title: "Fase I — Pulido integral del Portal de Cliente",
    summary: "Header con menú de usuario, listas densas con folios monoespaciados, ETA por proximidad, drill-down desde dashboard y banners con mejor contraste.",
    description: "PortalLayout: DropdownMenu anclado al avatar (Mi perfil + Cerrar sesión), avatar bg-primary, sección activa en mobile junto al burger, footer con versión. Listas: badge a la izquierda, folio font-mono, monto en columna fija con tabular-nums, padding compacto, filtros con min-w 180-200. Dashboard: chips y barra de estado son Link a /portal/embarques?estado=X (controller sincroniza query param). Banners aceptada/operación con bg-success/15 + text-foreground (AA dark). ETA con color por proximidad (<3d destructive, <7d warning).",
  },
  {
    version: "8.115.0",
    date: "2026-05-04",
    type: "minor",
    title: "Fase H — Identidad de marca unificada (BrandLockup)",
    summary: "Nuevo componente BrandLockup unifica logo + wordmark 'Libre Carga' en login, sidebar, portal y admin; tagline consistente y tokens en lib/ui/brand.ts.",
    description: "BrandLockup (icon/horizontal/stacked × sm/md/lg) centraliza el tratamiento del isotipo con fondo blanco constante en light/dark. Login reemplaza el bloque 176×176 por stacked + tagline. Sidebar deja de duplicar el nombre de la org (OrgSwitcher como única fuente). Portal muestra co-branding 'Portal de Cliente · {org}'. AdminSidebar adopta el mismo lockup. Tokens BRAND.* en src/lib/ui/brand.ts.",
  },
  {
    version: "8.114.0",
    date: "2026-05-04",
    type: "minor",
    title: "Fase G — Polish UI/UX en Reportes, Dashboard, filtros, KPIs y a11y",
    summary: "KPIs sin truncar a 1024px, filtros con min-width, deduplicación de clientes por RFC, chart Top Profit con escala nice y a11y reforzada.",
    description: "KpiCard oculta icono en mobile y reduce padding/gap; EmbarquesFiltrosCampos sube min-width y agrega title/aria-label; fetchClientes(Paginados) deduplica por RFC; ReportesTopChart con tickCount=5 + formateador $k/$M; DashboardStatusCards con aria-pressed/aria-label/focus-visible en timeline; sidebar badges con tooltip de conteo.",
  },
  {
    version: "8.113.0",
    date: "2026-05-04",
    type: "minor",
    title: "Polish UI/UX Fase D-F: header compacto, scroll horizontal, zebra reforzada, stepper responsive y a11y",
    summary: "Cierre de las fases pendientes de la auditoría visual: header global, charts, tablas y accesibilidad.",
    description: "Header h-16→h-12 con padding adaptativo; DataTable con overflow-x-auto y scrollbar fino; zebra reforzada (muted/45 light, /30 dark); StepIndicator responsive con role/listitem y aria-current; ReportesTopChart YAxis 110→170 + ticks truncados a 22 chars; complementa Fase A/B/C de v8.112.0.",
  },
  {
    version: "8.111.0",
    date: "2026-05-04",
    type: "minor",
    title: "Panel Super Admin: dashboard enriquecido, filtros, breadcrumbs y polish UI/UX integral",
    summary: "Auditoría visual del panel admin: 20+ mejoras de afford­ance, navegación, accesibilidad y densidad informativa.",
    description: "AdminLayout con breadcrumbs y max-width; sidebar con activo accent + dropdown de usuario; dashboard con KPIs clickables, gráfica por organización (recharts) y panel de últimas orgs; tablas Usuarios/Organizaciones con buscador, filtros, contadores y menú ⋯ por fila; badge Admin reasignado a accent (rojo solo destructivo); tabs de Configuración con underline; a11y mejorada con aria-labels y focus-visible.",
  },
  {
    version: "8.110.0",
    date: "2026-05-04",
    type: "minor",
    title: "QA visual completa: KPIs sin truncar, detalle de embarque por folio, redirects de Reportes y tooltips en sidebar",
    summary: "Cinco arreglos derivados de la auditoría visual en viewport 1000px.",
    description: "(1) Operaciones: KPIs con etiquetas cortas ('Cargas activas', 'Contenedores (TEU)', 'Profit USD', 'Alertas') y formatCurrencyCompact en Profit con tooltip del valor completo, eliminando 'Profit tota… US…' a <1100px. (2) Dashboard 'Arribos este mes': el bloque pasa de lg:flex-row a xl:flex-row para que las métricas y la barra de progreso no se aplasten contra el título a 1000px (resuelve solapamiento '29' / 'USD 20,808.49'). Profit ahora usa notación compacta. (3) Detalle de embarque: fetchEmbarqueFull acepta tanto UUID como expediente (folio human-readable tipo 'ELIMP00190'), resolviendo el folio contra la tabla embarques antes de invocar el RPC; deja de devolver 'Embarque no encontrado' al navegar por URL con folio. (4) Router: añadidos redirects /reportes y /rentabilidad → /reportes/rentabilidad para que las rutas naturales funcionen al teclear directo. (5) Sidebar: el badge numérico de Principal envuelve en Tooltip Radix con texto 'N alertas activas' y aria-label, dando contexto al rojo '26'.",
  },
  {
    version: "8.109.1",
    date: "2026-05-04",
    type: "patch",
    title: "QA visual: KPIs Reportes compactos, tabs Proveedores responsivas, tooltip ruta Cotizaciones",
    summary: "Tres ajustes derivados de la QA visual en viewports estrechos.",
    description: "(1) ReportesKpiCards usa formatCurrencyCompact con tooltip del valor completo. (2) TabsList de Proveedores ahora hace scroll horizontal/wrap en lugar de grid 5/10 cols. (3) Columna 'Origen → Destino' en Cotizaciones usa Tooltip de Radix.",
  },
  {
    version: "8.109.0",
    date: "2026-05-04",
    type: "minor",
    title: "Estandarización de tablas (Fase 2): paginación integrada, density y alineación numérica",
    summary: "Listados principales adoptan la prop pagination del DataTable; density explícita en todas las tablas y tabular-nums en columnas monetarias.",
    description: "Continuación del plan de tablas. (1) Paginación: Cotizaciones, Embarques, Clientes, Proveedores, Facturación (facturas) y TabProformas migrados a la prop integrada `pagination`; eliminado markup duplicado de PaginationControls externos y normalizado el reset de página a 0 al cambiar pageSize en TabProformas y Embarques. (2) Densidad: convención aplicada — listados principales = 'comfortable', sub-tablas/dashboards/configuración = 'compact'. Se añadió density explícita a 14 tablas que dependían del default implícito (ProfitTable, EmbarquesActivosTable, ClienteDetalle ×2, TabPlanes, OrgMembersCard, TabPuertos, TabNavieras, TabTiposContenedor, TablaContactos, TabPortalCliente, AdminUsuarios, AdminOrganizaciones, AdminOrg/Usuarios, ReportesTablaClientes). (3) Alineación numérica: añadido `align: 'right'` + `tabular-nums` a columnas monetarias en facturaColumns, gastoColumns, cotizacionColumns (centralizado y portal cliente), ResumenConceptosVenta y PasoConfirmacionProforma. Sin cambios funcionales — sólo consistencia visual.",
  },
  {
    version: "8.108.0",
    date: "2026-05-04",
    type: "minor",
    title: "Estandarización de tablas (Bloques B-E)",
    summary: "9 componentes adicionales migrados a DataTable: cliente, proveedor, portal, auditoría, reportes y operaciones.",
    description: "Migración de TablaContactos, TabPortalCliente, ProveedorDetalle, PortalEmbarqueDocumentos, ReportesTablaClientes (sort server-side), OperacionesWidgets, HallazgoTabla, HallazgosTabla y PasoConfirmacionProforma al DataTable estandarizado. Quedan en allowlist sólo los grids con inputs por celda (cotizaciones editables, DialogDuplicarEmbarque, TablaCostosDetalle).",
  },
  {
    version: "8.107.0",
    date: "2026-05-04",
    type: "minor",
    title: "Estandarización de tablas (Bloque A): detalle de Embarque",
    summary: "TabCostos, TabDocumentos, TabResumen, ResumenConceptosVenta, HistorialProformas e HistorialFacturas migrados a DataTable.",
    description: "Seis componentes del detalle de embarque ahora usan el DataTable estandarizado en vez de tablas crudas. Misma UX visual con consistencia de densidad, alineación, empty state y sticky headers; los botones de acción usan e.stopPropagation() para no disparar row clicks accidentalmente.",
  },
  {
    version: "8.106.0",
    date: "2026-05-04",
    type: "minor",
    title: "Estandarización de tablas (Fase 1): DataTable extendido + lint",
    summary: "DataTable gana density, striped, hoverable, bordered, align por columna, footer y paginación integrada; lint prohíbe usar @/components/ui/table fuera de la allowlist.",
    description: "Fase 1 del plan de estandarización de tablas. DataTable acepta density, striped, hoverable, bordered, align por columna, footer y paginación integrada. Nueva regla ESLint que bloquea importar @/components/ui/table directamente, con allowlist para grids editables de cotización. Guía nueva en docs/tables.md. Cambios retro-compatibles.",
  },
  {
    version: "8.105.0",
    date: "2026-05-04",
    type: "minor",
    title: "Refactor del sistema de Changelog: dedupe, validación y UX",
    summary: "Eliminada la duplicación entre recentChangelog y chunk0; nuevo script CLI, tests de integridad, filtros, búsqueda y anclas profundas en /changelog.",
    description: "Refactor integral del sistema de changelog basado en auditoría. (1) Fuente única de verdad: chunk0 mantiene todas las entradas v8; recentChangelog conserva sólo las 5 más recientes para bundle inicial mínimo y los loaders deduplican por version. (2) Nuevo script `npm run changelog:add` (scripts/add-changelog.ts). (3) Tests de integridad. (4) UI mejorada en /changelog: filtros, búsqueda y anclas. (5) Loader genérico. (6) Generador de public/changelog.json. Sin breaking changes.",
  },
  {
    version: "8.104.0",
    date: "2026-05-02",
    type: "minor",
    title: "Embarques: ordenamiento global server-side en la tabla",
    summary: "El sort por columna en Embarques ahora aplica sobre todos los registros del servidor, no sólo la página visible.",
    description: "El ordenamiento por columna en la tabla de Embarques (Expediente, Cliente, Modo, Estado, ETD, ETA, Operador) ahora se aplica sobre todos los registros en el servidor, no sólo sobre la página visible. Antes, hacer click en un header sólo reordenaba los 20 registros cargados, lo cual era engañoso con datasets grandes. Ahora la consulta a la base de datos incluye el sort solicitado y la página se recalcula desde el primer resultado global. Aparece un indicador 'Ordenado por X ↑ · global' arriba de la tabla con un atajo para quitar el orden y volver al default (created_at desc). Otras tablas del sistema mantienen su comportamiento client-side existente — esto fue un opt-in sólo para Embarques.",
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

/** Compat: alias histórico de loadChangelogMajor(8). */
export async function loadChangelogV8(): Promise<ChangelogEntry[]> {
  return loadChangelogMajor(8);
}

/** Carga perezosa del changelog histórico (v7.x y anteriores). */
export async function loadLegacyChangelog(): Promise<ChangelogEntry[]> {
  const mod = await import("./changelog/legacy");
  return mod.legacyChangelog;
}

/** Compat: array completo solo si se necesita explícitamente (no recomendado). */
export const changelog = recentChangelog;
