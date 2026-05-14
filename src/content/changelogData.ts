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
    version: "8.147.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 4: refactor PortalLayout, Changelog, TabTracking y DialogBolContainers",
    summary: "Cuatro componentes >200 líneas reducidos a shells delgados con controllers y subcomponentes. Componentes >200 líneas: 17 → 13.",
    description: "Tercera iteración de la Fase 4 (ARCHITECTURE.md §20.4). (1) PortalLayout (266 → 60): nuevos módulos en components/portal/layout/ — portalNav.ts (constantes/helpers), PortalMobileNav, PortalUserMenu, PortalHeader, PortalBreadcrumbsBar y usePortalBreadcrumbs. (2) Changelog page (261 → 76): lógica de paginación/filtros/anclas/expand movida a hooks/dashboard/useChangelogController.ts; cada tarjeta en components/dashboard/ChangelogEntryCard.tsx. (3) TabTracking (252 → 88): nuevos subcomponentes en components/embarque/tracking/ — TrackingEventTimeline y TrackingNuevoEventoForm (Card + RHF + zod). (4) DialogBolContainers (246 → 95): lógica BL/sync/persistencia movida a hooks/embarque/useDialogBolContainers.ts; render del resultado en components/embarque/dialogBol/BolContainersResult.tsx. Tests: 314 verdes. Sin cambios de UI ni de comportamiento.",
  },
  {
    version: "8.146.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 4: refactor MarcarRevisadoDialog y TrackingLiveCard",
    summary: "MarcarRevisadoDialog (306 → 100) y TrackingLiveCard (281 → 56) se parten en subcomponentes por sección. Componentes >200 líneas: 19 → 17.",
    description: "Segunda iteración de la Fase 4. (1) MarcarRevisadoDialog se reduce a shell que orquesta tabs y footer; los tres tabs viven en src/components/auditoria/marcarRevisado/ (AccionTab + AccionButton, ComentariosTab, SnoozeTab) y el resumen del hallazgo en HallazgoSummary. (2) TrackingLiveCard se reduce a un Card con Header + delegación; nuevos subcomponentes en src/components/embarque/trackingLive/ (TrackingActions, TrackingWarnings, TrackingFechasPropuestas, TrackingSummaryGrid). El hook controller useTrackingLiveCard sigue siendo el único punto de lógica. Tests: 314 verdes. Sin cambios visibles ni de comportamiento. Quedan 17 componentes >200 líneas.",
  },
  {
    version: "8.145.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 4: refactor Auditoria.tsx (297 → 87 líneas)",
    summary: "La página Auditoria queda como shell delgado: extraídos AuditoriaHallazgosTab, AuditoriaPorReglaTab y helper puro lib/domain/auditoriaCsv. Componentes >200 líneas: 20 → 19.",
    description: "Primer dominio de la Fase 4 del plan The Power of 10. (1) src/pages/Auditoria.tsx pasa de 297 a 87 líneas eliminando renderHallazgosTab/renderPorReglaTab inline y la lógica de exportCsv. (2) Nuevo src/components/auditoria/AuditoriaHallazgosTab.tsx (KPIs + filtros + toggle revisados + HallazgosTablaPaginada). (3) Nuevo src/components/auditoria/AuditoriaPorReglaTab.tsx (accordion por regla con HallazgoTabla). (4) Nuevo src/lib/domain/auditoriaCsv.ts con exportHallazgosCsv() — función pura sin dependencias de React, mapeo de filas y constante de columnas. (5) scripts/audit-power10.ts también ignora src/content/changelogData.ts (descripciones contienen 'as any' como texto). Tests: 314 verdes. Sin cambios de UI ni de comportamiento.",
  },
  {
    version: "8.144.0",
    date: "2026-05-14",
    type: "minor",
    title: "Power of 10 — Fase 3: ESLint endurecido (no-explicit-any error)",
    summary: "`@typescript-eslint/no-explicit-any` pasa a `error`, `max-lines-per-function` sube a 200 para alinear con §20.4. TabResumen elimina su `any` casteando a tipo Partial; quedan 0 `any` reales en src/.",
    description: "Cierre de la Fase 3 del plan The Power of 10. (1) eslint.config.js: `@typescript-eslint/no-explicit-any: error` (con eslint-disable puntual documentado en appFeedback.ts/listado.ts), `max-lines-per-function: 200` (alineado con §20.4), exempción agregada para src/content/changelog/** (chunks largos por diseño). (2) TabResumen.tsx: los dos `(embarque as any).etd_original/eta_original` se reemplazan por un IIFE que castea a `Partial<{ etd_original; eta_original }>`. (3) scripts/audit-power10.ts ahora ignora src/content/changelog/** y líneas con `eslint-disable @typescript-eslint/no-explicit-any` arriba — la baseline pasa de 17 a 0 `any` reales. APP_VERSION 8.144.0.",
  },
  {
    version: "8.143.0",
    date: "2026-05-14",
    type: "minor",
    title: "Adopción de The Power of 10 — Fases 1 y 2",
    summary: "10 reglas obligatorias para generar código (componentes ≤200, sin `any`, paginación en listas, cleanup en effects, manejar `error` de Supabase). Documentadas en ARCHITECTURE.md §20 y memorizadas. Baseline read-only en docs/power10-baseline.md.",
    description: "ARCHITECTURE.md §20 + mem://principles/power-of-10 + scripts/audit-power10.ts (genera docs/power10-baseline.md). Sin cambios de código de aplicación. Fases 3 (ESLint) y 4 (limpieza por dominio) pendientes.",
  },
  {
    version: "8.142.0",
    date: "2026-05-14",
    type: "minor",
    title: "lib/domain/auditoria — reglas puras testables",
    summary: "Reglas puras de auditoría (snooze, severidad, agrupación, filtros) extraídas a src/lib/domain/auditoria.ts con 15 tests; ARCHITECTURE.md documenta queries + mutations + subdominios.",
    description: "Cierre de los pasos 2 y 3 opcionales de la auditoría arquitectónica. Nuevas funciones puras (isoDate, minSnoozeDate, isSnoozeActivo, contarPorSeveridad, agruparPorRegla, filtrarHallazgos) consumidas por useAuditoriaPageController y useMarcarRevisadoController; ARCHITECTURE.md gana la subsección 5.1.",
  },
  {
    version: "8.141.0",
    date: "2026-05-14",
    type: "minor",
    title: "services/cotizacion estandarizado a queries + mutations",
    summary: "El service de cotizaciones adopta la convención `queries.ts` (lecturas) + `mutations.ts` (escrituras); el archivo legacy `crud.ts` desaparece.",
    description: "Paso 4 de la auditoría arquitectónica. services/cotizacion/crud.ts (172 líneas) se partió en queries.ts (folio + lecturas) y mutations.ts (crear/update/delete/cambiar estado). El barrel index.ts conserva la API pública e introduce la convención `queries + mutations + subdominios (costos, conversiones, wizard)`. conversiones/duplicar.ts importa generarFolioCotizacion desde ../queries.",
  },
  {
    version: "8.140.1",
    date: "2026-05-14",
    type: "patch",
    title: "Rotación del chunk0 del changelog v8",
    summary: "v8/chunks/0.ts (1086 líneas, 145 entradas) se redujo a 20 entradas; las 125 entradas anteriores se trasladaron a v8/chunks/6.ts.",
    description: "Cierre del paso 3 de la auditoría arquitectónica. v8/chunks/0.ts crecía sin límite. Se extrajeron las entradas 21-145 (8.132.1 → 8.64.0) al nuevo v8/chunks/6.ts y se registró en v8.ts. El orden cronológico descendente se preserva al concatenar chunk0 → … → chunk6.",
  },
  {
    version: "8.140.0",
    date: "2026-05-14",
    type: "minor",
    title: "Auditoría: controllers de diálogos de auditoría y RHF en TabTracking",
    summary: "MarcarRevisadoDialog y AsignarResponsableDialog ahora usan hooks controller dedicados; el form de TabTracking migra a react-hook-form + zod.",
    description: "Pasos 6 y 7 de la auditoría arquitectónica. Nuevos useMarcarRevisadoController y useAsignarResponsableController encapsulan estado local, efectos de sincronización con la revisión existente y handlers (guardar, eliminar, snooze, quitarSnooze, agregar comentario, tomarlo yo). Los diálogos quedan como pura presentación. TabTracking migra su formulario inline (4 useState) a react-hook-form + zodResolver con eventoSchema (tipo requerido, fecha requerida, ubicación ≤120, descripción ≤500), errores inline y reset al guardar. Pendientes: rotar chunk0 → chunk6 (1078 líneas) y documentar convenciones en ARCHITECTURE.md.",
  },
  {
    version: "8.139.0",
    date: "2026-05-14",
    type: "minor",
    title: "Auditoría arquitectónica: split de queries y controller de tracking",
    summary: "services/embarque/queries.ts (355 líneas) se partió en 6 submódulos por subdominio y TrackingLiveCard ahora consume un hook controller dedicado.",
    description: "Continuación de la auditoría arquitectónica. (1) services/embarque/queries.ts pasó a ser una carpeta queries/ con archivos por subdominio: listado.ts (lista, paginada, export, relacionados, list extras RPC), detalle.ts (byId + get_embarque_full), conceptos.ts (venta + costo), colaterales.ts (documentos, notas, facturas), expedientes.ts (agrupación por folio) y proveedores.ts. El barrel queries/index.ts re-exporta todo, así no cambian imports en consumidores. (2) Toda la lógica de TrackingLiveCard se movió a hooks/embarque/useTrackingLiveCard.ts: queries/mutations de JSONCargo, estado del diálogo BL, dismiss de fechas, derivados de prefix mismatch / naviera no soportada, handlers onSync y onAplicarFechas con feedback de toasts. El componente queda como render puro consumiendo el hook, mucho más fácil de testear y reusar. Pendientes restantes (próxima iteración): crear lib/domain/auditoria.ts con tests y reducir MarcarRevisadoDialog (409 líneas) y AsignarResponsableDialog (242) a UI + controller; migrar TabTracking a react-hook-form. Tests: 298 verdes (pre-existente changelog ≤10 sigue rojo).",
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
