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
    version: "8.118.6",
    date: "2026-05-06",
    type: "patch",
    title: "Tests del módulo Auditoría: 23 casos para hooks y derivaciones",
    summary: "Nuevas suites para useAuditoriaEjecutivo, useAuditoriaPageController, useHallazgosTablaState y hallazgoHash. 23 tests verdes.",
    description: "Cobertura end-to-end de los hooks de Auditoría con I/O mockeado: score, penalización por severidad, exclusión de revisados, riesgo financiero, ETA (vencidos/urgentes/edad), MTTR + ranking, drill-down (severidad/cliente/búsqueda/soloVencidos/responsable), paginación, modos y hash determinista.",
  },
  {
    version: "8.118.5",
    date: "2026-05-06",
    type: "patch",
    title: "Documentación: arquitectura y flujo de datos del módulo Auditoría",
    summary: "Nuevo docs/auditoria.md con el desglose de componentes ejecutivos, hooks del dominio y flujo de datos end-to-end.",
    description: "Guía de mantenimiento tras los Sprints 1-3 del refactor: mapa de capas, tabla de hooks, árbol de subcomponentes, helpers compartidos, fuente única de configuración de reglas y convenciones para extender el módulo. Sólo documentación.",
  },
  {
    version: "8.118.4",
    date: "2026-05-06",
    type: "patch",
    title: "Refactor Sprint 3: Auditoría ejecutiva troceada y tests de proyección",
    summary: "AuditoriaEjecutivoTab pasa de 418 a 94 LOC al extraer 5 subcomponentes; se añaden 15 tests a la lógica de proyección de facturación.",
    description: "Subcomponentes EjecutivoScoreCard, EjecutivoAtencionCard, EjecutivoAlertasUrgencia, EjecutivoDistribucionRow y EjecutivoPorReglaGrid extraídos a components/auditoria/ejecutivo/. Helpers visuales y SCORE_ESTADO_CONFIG aislados. Nuevo test suite cubre conversiones de moneda, agrupación, KPIs y meses disponibles.",
  },
  {
    version: "8.118.3",
    date: "2026-05-06",
    type: "patch",
    title: "Refactor Sprint 2: config de auditoría centralizada y subcomponentes de Proyección extraídos",
    summary: "Se centralizó la configuración de reglas de auditoría y se extrajeron CierreCard y las columnas de Proyección.",
    description: "Nuevo módulo lib/ui/auditoriaConfig.ts (REGLA_INFO + REGLAS_ORDEN) consumido por Auditoria.tsx y AuditoriaEjecutivoTab.tsx, eliminando duplicación. CierreCard y proyeccionColumns extraídos de TabProyeccion.tsx. Sin cambios visuales.",
  },
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
