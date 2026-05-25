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
  {
    version: "11.4.0",
    date: "2026-05-25",
    type: "minor",
    title: "CRM Sprint B: configuración, filtros, bulk y CSV",
    summary: "Pestaña Configuración del CRM, filtros avanzados en Oportunidades, selección múltiple en Leads, import CSV y datos accionables (mailto/tel + copiar).",
    description: "EtapasPipelineEditor y MotivosPerdidaEditor en /crm/configuracion. OportunidadesFiltersBar (etapa/vendedor/cierre/monto) filtra Kanban y Tabla. LeadsBulkBar permite cambiar estado, reasignar vendedor o eliminar selección múltiple. ImportarLeadsCsvDialog con preview y batches de 100. ContactActions (mailto/tel + copiar) en LeadDetalle. APP_VERSION 11.4.0.",
  },
  {
    version: "11.3.1",
    date: "2026-05-25",
    type: "patch",
    title: "CRM Sprint A cierre: linaje, badges y acciones rápidas",
    summary: "Linaje visible Lead↔Oportunidad↔Cotización↔Embarque, badges de actividades vencidas y botones Completar/Posponer inline.",
    description: "LineageCard en LeadDetalle y OportunidadDetalle. Badge de vencidas en tab Actividades (CrmLayout) y en item CRM del sidebar. Columna de acciones inline (Completar / Posponer +1d/+3d/+1sem) en /crm/actividades para roles con canEditCrm. APP_VERSION 11.3.1.",
  },
  {
    version: "11.3.0",
    date: "2026-05-25",
    type: "minor",
    title: "CRM Sprint A: Dashboard real + asignación de vendedor",
    summary: "Dashboard CRM con widgets accionables y selector de vendedor en leads/oportunidades.",
    description: "useCrmDashboard.ts + nuevo CrmDashboard con Mis actividades de hoy, Cerrando esta semana, Leads sin contactar >7 días, Top 5 deals, Mini-embudo. VendedorSelect (admin/operador) en alta de leads/oportunidades. usePosponerActividad y useActividadesVencidasCount añadidos. canEditCrm incluye rol vendedor. APP_VERSION 11.3.0.",
  },
  {
    version: "11.2.1",
    date: "2026-05-25",
    type: "patch",
    title: "CRM: navegación interna por tabs",
    summary: "Sidebar muestra un solo item 'CRM'; las secciones internas (Dashboard, Leads, Oportunidades, Actividades, Forecast, Reportes) viven en tabs dentro del módulo.",
    description: "Nuevo CrmLayout con tabs (NavLink) y rutas anidadas bajo /crm. SIDEBAR_CRM_ITEMS reducido a un único enlace. APP_VERSION 11.2.1.",
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
