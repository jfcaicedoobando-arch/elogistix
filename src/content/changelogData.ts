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
  {
    version: "8.103.1",
    date: "2026-05-02",
    type: "patch",
    title: "Auditoría: pestaña 'Detalle operativo' renombrada a 'Hallazgos'",
    summary: "Cambio de etiqueta para alinear la UI con el lenguaje del equipo.",
    description: "Renombrada la segunda pestaña del módulo /auditoria de 'Detalle operativo' a 'Hallazgos' para alinear el lenguaje de la UI con cómo el equipo se refiere al contenido (la lista de hallazgos accionables). Sin cambios funcionales ni de datos: el value interno del tab se conserva ('tabla'), por lo que el drill-down desde Resumen ejecutivo y los enlaces preexistentes siguen funcionando.",
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
