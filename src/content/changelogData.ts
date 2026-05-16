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
    version: "8.155.1",
    date: "2026-05-16",
    type: "patch",
    title: "Seguridad — guard org en proformas y lectura de auditoría restringida a staff",
    summary: "generar_numero_proforma rechaza orgs ajenas; auditoria_comentarios y auditoria_revisiones sólo se leen por admin/operador/super_admin.",
    description: "RPC generar_numero_proforma valida que la organización coincida con el caller (o super_admin) antes de devolver el siguiente folio, cerrando la fuga del conteo anual de proformas. Las políticas SELECT de auditoria_comentarios y auditoria_revisiones añaden el check de rol admin/operador/super_admin para que viewers no lean comentarios internos ni emails de staff.",
  },
  {
    version: "8.155.0",
    date: "2026-05-16",
    type: "minor",
    title: "Seguridad — endurecimiento multi-tenant en storage, user_roles y edge functions",
    summary: "Bucket documentos exige path con organization_id, user_roles deja de filtrar roles cross-tenant a admins, parse-csf requiere JWT y valida tipo/tamaño, y create/list/delete-user usan CORS con whitelist.",
    description: "documentos: políticas de upload/update/delete ahora exigen que la primera carpeta del path sea el organization_id del usuario. user_roles: la rama de admin en SELECT se restringe a usuarios que comparten organización con el caller; super_admin sigue viendo todo. parse-csf: ahora requiere JWT (authenticate), valida application/pdf y tope de 5 MB, y usa CORS con whitelist; el cliente bloquea la llamada si no hay sesión. create-user / list-users / delete-user: handlePreflightStrict + buildCors propagado en todas las respuestas.",
  },
  {
    version: "8.154.0",
    date: "2026-05-16",
    type: "minor",
    title: "Seguridad — aislamiento multi-tenant en facturas, documentos y digest",
    summary: "Bucket facturas privado con políticas por org, lectura de documentos exige join a embarques del mismo tenant, y digest semanal filtra por organización.",
    description: "facturas: bucket privado + políticas SELECT/INSERT/UPDATE/DELETE por organization_id en el path; frontend usa URLs firmadas vía FacturaDownloadButton. documentos: política de lectura ahora hace JOIN a embarques y valida organization_id en ambos lados. auditoria_embarques_org: nuevo overload con p_organization_id obligatorio y el digest semanal lo invoca por tenant, eliminando la fuga cross-tenant. RPCs de embarques ya tenían guardas de org.",
  },
  {
    version: "8.153.3",
    date: "2026-05-16",
    type: "patch",
    title: "Embarques — estado por UTC para cuadrar con el dashboard",
    summary: "calcularEstadoEmbarque ahora compara fechas en UTC igual que el backend. Cuadra el conteo de Arribo entre dashboard y listado.",
    description: "El cálculo client-side usaba hora local del navegador; en UTC-6 (México) un embarque con ETA = hoy-UTC quedaba como En Tránsito mientras el dashboard lo contaba como Arribo. Ahora hoy/etd/eta se comparan en UTC, igual que current_date de Postgres.",
  },
  {
    version: "8.153.2",
    date: "2026-05-16",
    type: "patch",
    title: "Embarques — filtro por estado: conteos y paginación correctos",
    summary: "Filtrar por estado ahora trae todo el set y filtra/pagina client-side. Cuadra con el dashboard y arregla el bug de '10/pág'.",
    description: "useEmbarquesPageState usa fetchEmbarquesParaExport cuando hay filtro de estado, aplica calcularEstadoEmbarque sobre el set completo, deduplica por expediente y pagina en memoria. contenedoresCount/expedientesCount reflejan el set real.",
  },
  {
    version: "8.153.1",
    date: "2026-05-16",
    type: "patch",
    title: "Embarques — encabezado muestra contenedores y expedientes",
    summary: "El header del listado ahora dice 'N contenedores en M expedientes' para alinearse con el dashboard.",
    description: "useEmbarquesPageState expone expedientesCount y contenedoresCount; Embarques.tsx los usa en PageHeader. Resuelve la inconsistencia visual donde el dashboard mostraba 4 en Arribo pero el listado decía '1 embarques encontrados'.",
  },
  {
    version: "8.153.0",
    date: "2026-05-16",
    type: "minor",
    title: "Dashboard — los círculos de estado ahora navegan a Embarques filtrado",
    summary: "Clic en Confirmado / En Tránsito / Arribo / En Aduana / Entregado lleva a /embarques?estado=<Estado>.",
    description: "DashboardStatusCards llama navigate(`/embarques?estado=${estado}`) en lugar del toggle visual previo. Eliminado el useState huérfano filtroEstado en useDashboardData y las props correspondientes.",
  },
  {
    version: "8.152.4",
    date: "2026-05-16",
    type: "patch",
    title: "Sidebar — tooltips legibles cuando está colapsado",
    summary: "Tooltips del sidebar colapsado ahora usan fondo oscuro, borde y sombra para no mezclarse con las cards del contenido principal.",
    description: "SidebarGroupBlock pasa la prop `tooltip` como objeto al SidebarMenuButton con className 'bg-sidebar text-sidebar-foreground border-sidebar-border shadow-xl font-medium' y sideOffset=8.",
  },
  {
    version: "8.152.3",
    date: "2026-05-15",
    type: "patch",
    title: "Dashboard — fix posición tooltip 'Cargas activas por cliente'",
    summary: "Tooltip ya no se trunca contra el borde izquierdo; ahora se muestra arriba de la fila.",
    description: "TooltipContent cambia de side='left' a side='top' align='end' collisionPadding={16} en CargasActivasClienteCard para evitar el clipping contra el sidebar.",
  },
  {
    version: "8.152.2",
    date: "2026-05-15",
    type: "patch",
    title: "Dashboard — tooltip y subtítulo explícitos en 'Cargas activas por cliente'",
    summary: "El header explica qué estados se cuentan; tooltip enriquecido con desglose y nota '% del total de tu organización'.",
    description: "Subtítulo en el header listando los 5 estados incluidos. Tooltip nativo reemplazado por shadcn Tooltip con nombre, totales, % y línea 'Incluye embarques en: ...'. Etiqueta de barra cambia a '45% del total' en ≥md. Cuando el total global es 0, se muestra '—' en lugar de 0%. Aria-label por fila.",
  },
  {
    version: "8.152.1",
    date: "2026-05-15",
    type: "patch",
    title: "Dashboard — corrección de totales y barra de proporción en 'Cargas activas por cliente'",
    summary: "El número grande ahora coincide siempre con la suma de los chips visibles, y la barra/porcentaje representa la concentración real del cliente sobre el total activo de TODOS los clientes.",
    description: "RPC dashboard_details() agrega cargasActivasTotal (conteo global de embarques en los 5 estados visibles). CargasActivasClienteCard recalcula el total a partir del desglose y omite filas con suma 0. La barra ahora se dimensiona contra el total global (no contra el #1 del top), con mínimo visual de 4px y tooltip 'N de M cargas activas'.",
  },
  {
    version: "8.152.0",
    date: "2026-05-15",
    type: "minor",
    title: "Filtros y paginación sincronizados a la URL — adopción de nuqs + libphonenumber-js",
    summary: "Los listados (Embarques, Cotizaciones, Pre-Facturación, Clientes, Proveedores) ahora reflejan search/filtros/página/orden en la URL, lo que los hace compartibles y persistentes al refresh. Teléfonos formateados con libphonenumber-js.",
    description: "nuqs (NuqsAdapter en App.tsx) sustituye useState en useListPageState y useEmbarquesPageState, manteniendo la API pública. Los listados de Embarques, Cotizaciones, Pre-Facturación, Clientes y Proveedores ganan filtros compartibles y persistentes al refresh. libphonenumber-js/min reemplaza el set hardcodeado de ladas MX en formatPhoneMx, preservando el formato visual '(LADA) NNNN-NNNN'. Tests adaptados con withNuqsTestingAdapter. PDFs siguen via window.print() y CSV se difiere a Google Sheets por decisión del usuario.",
  },
  {
    version: "8.151.0",
    date: "2026-05-15",
    type: "patch",
    title: "Seguridad — RPCs de embarque, user_roles y storage de documentos",
    summary: "Cierre de 3 hallazgos del scanner: ownership check en RPCs de embarque, user_roles solo super_admin, y bucket 'documentos' con scope por organización.",
    description: "RPCs actualizar/duplicar_embarque_completo validan organization_id del embarque vs caller; crear_embarque_completo ignora payload.organization_id y usa current_user_org_id(). Eliminada policy 'Admins manage non-super-admin roles' en user_roles (solo super_admin). Storage 'documentos' SELECT ahora requiere documentos_embarque.organization_id = current_user_org_id() (con fallback para clientes del portal).",
  },
  {
    version: "8.150.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 4: cierre de Regla #4 (0 componentes >200 líneas)",
    summary: "Últimos 5 componentes >200 líneas reducidos: PortalEmbarqueDetalle (239→184), CotizacionDetalle (219→181), TabProyeccion (216→150), cotizacionesColumns (208→117), ClienteDetalle (206→194). Baseline Regla #4: 5 → 0.",
    description: "Sexta iteración de la Fase 4 (ARCHITECTURE.md §20.4). (1) PortalEmbarqueDetalle: extraído PortalEmbarqueResumenTab. (2) CotizacionDetalle: nuevo CotizacionDatosGeneralesCard. (3) TabProyeccion: bloque 'Cierre' movido a ProyeccionCierreSection. (4) cotizacionesColumns: helpers renderEstadoVigencia y renderAcciones movidos a columnsParts/. (5) ClienteDetalle: tres diálogos agrupados en ClienteDetalleDialogs. Tests: 314 verdes. Auditoría power-of-10: 0 hallazgos en Regla #4.",
  },
  {
    version: "8.149.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 4: refactor AdminUsuarios, AsignarResponsableDialog, CotizacionWizardLayout, Embarques y Cotizaciones",
    summary: "Cinco componentes >200 líneas reducidos a shells: AdminUsuarios (221→72), AsignarResponsableDialog (218→146), CotizacionWizardLayout (228→133), Embarques (208→157), Cotizaciones (215→176). Componentes >200 líneas: 10 → 5.",
    description: "Quinta iteración de la Fase 4 (ARCHITECTURE.md §20.4). (1) AdminUsuarios: nuevos AdminUsuariosFilters, adminUsuariosColumns y useAdminUsuariosController. (2) AsignarResponsableDialog: subcomponentes AsignacionExistenteInfo y FechaLimitePicker en components/auditoria/asignarResponsable/. (3) CotizacionWizardLayout: PasoDatosGenerales y CotizacionWizardFooter en components/cotizacion/wizard/. (4) Embarques: EmbarquesEmptyState y EmbarquesSortIndicator. (5) Cotizaciones: CotizacionesMobileFilters. Tests: 314 verdes. Sin cambios de UI ni de comportamiento.",
  },
  {
    version: "8.148.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 4: refactor DataTable, AppSidebar y AdminOrganizaciones",
    summary: "Tres componentes >200 líneas reducidos a shells delgados: DataTable (336 → 130), AppSidebar (216 → 107), AdminOrganizaciones (225 → 64). Componentes >200 líneas: 13 → 10.",
    description: "Cuarta iteración de la Fase 4 (ARCHITECTURE.md §20.4). (1) DataTable: nuevos módulos en components/shared/dataTable/ — types.ts, useDataTableSort.ts, DataTableHeaderRow.tsx y DataTableBody.tsx. API pública retro-compatible (tipos re-exportados). (2) AppSidebar: configuración de items a sidebarItems.ts; el footer con avatar y dropdown extraído a SidebarUserMenu.tsx. (3) AdminOrganizaciones: lógica a hooks/admin/useAdminOrganizacionesController.ts; UI partida en AdminOrganizacionesFilters, NuevaOrganizacionDialog y adminOrganizacionesColumns. Tests: 314 verdes. Sin cambios de UI ni de comportamiento.",
  },
  {
    version: "8.147.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 4: refactor PortalLayout, Changelog, TabTracking y DialogBolContainers",
    summary: "Cuatro componentes >200 líneas reducidos a shells delgados con controllers y subcomponentes. Componentes >200 líneas: 17 → 13.",
    description: "Tercera iteración de la Fase 4 (ARCHITECTURE.md §20.4). (1) PortalLayout (266 → 60): nuevos módulos en components/portal/layout/ — portalNav.ts (constantes/helpers), PortalMobileNav, PortalUserMenu, PortalHeader, PortalBreadcrumbsBar y usePortalBreadcrumbs. (2) Changelog page (261 → 76): lógica de paginación/filtros/anclas/expand movida a hooks/dashboard/useChangelogController.ts; cada tarjeta en components/dashboard/ChangelogEntryCard.tsx. (3) TabTracking (252 → 88): nuevos subcomponentes en components/embarque/tracking/ — TrackingEventTimeline y TrackingNuevoEventoForm (Card + RHF + zod). (4) DialogBolContainers (246 → 95): lógica BL/sync/persistencia movida a hooks/embarque/useDialogBolContainers.ts; render del resultado en components/embarque/dialogBol/BolContainersResult.tsx. Tests: 314 verdes. Sin cambios de UI ni de comportamiento.",
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
