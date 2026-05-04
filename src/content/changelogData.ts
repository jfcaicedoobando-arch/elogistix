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
    version: "8.105.0",
    date: "2026-05-04",
    type: "minor",
    title: "Refactor del sistema de Changelog: dedupe, validación y UX",
    summary: "Eliminada la duplicación entre recentChangelog y chunk0; nuevo script CLI, tests de integridad, filtros, búsqueda y anclas profundas en /changelog.",
    description: "Refactor integral del sistema de changelog basado en auditoría. (1) Fuente única de verdad: chunk0 mantiene todas las entradas v8; recentChangelog conserva sólo las 5 más recientes para bundle inicial mínimo y los loaders deduplican por version. (2) Nuevo script `npm run changelog:add` (scripts/add-changelog.ts) que valida semver, fecha ISO, type, prepende la entrada en chunk0 y recentChangelog, bumpea APP_VERSION atómicamente y rota recentChangelog a 5 elementos. (3) Tests de integridad (src/content/__tests__/changelog.test.ts): orden descendente, semver válido, versiones únicas, APP_VERSION sincronizado con la última entrada, sin duplicados visibles tras dedupe. (4) UI mejorada en /changelog: filtros por tipo (Major/Minor/Patch), búsqueda en título+descripción, anclas profundas con id={`v${version}`} y soporte de location.hash con scroll automático, summary/details opcional con expand. (5) Loader genérico `loadChangelogMajor(n)` reemplaza loadChangelogV8 (que queda como shim). (6) Generador `npm run changelog:json` que produce public/changelog.json en build para consumo externo (RSS, Slack webhooks, etc.). Sin breaking changes para los consumidores existentes.",
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
  {
    version: "8.103.0",
    date: "2026-05-02",
    type: "minor",
    title: "Auditoría Fase 3: fugas financieras, MTTR, snooze, comentarios y tendencia 30d",
    summary: "Nuevas reglas financieras, MTTR, snooze de hallazgos, comentarios y tendencia 30 días en /auditoria.",
    description: "Nuevas reglas financieras (margen negativo, margen bajo, venta sin costo, costo sin venta, proforma vencida, embarque huérfano) con umbrales configurables por organización en la nueva pestaña 'Auditoría' de Configuración. La vista ejecutiva suma tarjetas de Riesgo financiero pendiente en MXN, MTTR (tiempo medio de resolución), top de operadores y una gráfica de tendencia 30 días basada en snapshots diarios. El diálogo de hallazgo se reorganiza en tabs Acción / Comentarios / Snooze: hilo de discusión persistente y snooze con fecha y motivo obligatorios para silenciar ruido temporal sin perder trazabilidad. El tab por defecto pasa a 'Resumen ejecutivo' para administradores. Edge functions nuevas: captura diaria de snapshots y digest semanal por correo a los admins (vía Resend). Nuevas tablas auditoria_comentarios y auditoria_snapshots con RLS tenant; columnas snoozed_until/snooze_motivo en auditoria_revisiones.",
  },
  {
    version: "8.102.0",
    date: "2026-05-02",
    type: "minor",
    title: "Auditoría Fase 2: asignación de responsable y workflow de hallazgos",
    summary: "Hallazgos pueden asignarse a un responsable con fecha límite y workflow pendiente → en progreso → revisado.",
    description: "Cada hallazgo ahora puede asignarse a un responsable (admin u operador de la organización) con fecha límite opcional. Se incorpora un workflow de tres estados (pendiente → en progreso → revisado) y se registra siempre quién hizo la asignación y cuándo. Nuevo diálogo 'Asignar responsable' con selector de usuario, calendario de fecha límite y botón 'Tomarlo yo' que auto-asigna y mueve el hallazgo a 'En progreso'. La tabla de hallazgos suma una columna 'Responsable' con email del asignado e ícono de alerta cuando la fecha límite está vencida; la celda de revisión distingue ahora visualmente el estado 'En progreso' (badge ámbar). Nuevos filtros: 'Responsable' (todos / asignados a mí / sin asignar / vencidos) y opción 'En progreso' en el filtro de revisión. Toda asignación o toma queda en bitácora (acciones asignar_hallazgo y tomar_hallazgo). Migración: estado_hallazgo_revision enum nuevo y columnas responsable_id, responsable_email, asignado_por, asignado_por_email, asignado_at, fecha_limite y estado_revision en auditoria_revisiones; accion_tomada y revisado_por se vuelven opcionales. RLS sin cambios.",
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
