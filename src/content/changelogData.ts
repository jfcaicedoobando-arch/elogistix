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
  {
    version: "8.138.0",
    date: "2026-05-14",
    type: "minor",
    title: "Auditoría arquitectónica: limpieza de capas",
    summary: "Unificado useToast (eliminado duplicado), DialogBolContainers ya no llama Supabase directo, tipos de fila de embarque migrados a types/embarque.ts.",
    description: "Resultado de la auditoría de arquitectura: (1) eliminado src/hooks/shared/use-toast.ts (re-export huérfano que duplicaba el singleton de toasts); (2) DialogBolContainers ya no importa @/integrations/supabase/client — la actualización del contenedor pasa por el nuevo services/embarque/contenedor.ts y el hook useActualizarContenedorEmbarque; (3) los aliases EmbarqueRow/ConceptoVentaRow/ConceptoCostoRow/DocumentoEmbarqueRow/NotaEmbarqueRow se centralizaron en src/types/embarque.ts y el barrel hooks/embarque/useEmbarques.ts los re-exporta para compatibilidad. Pendientes de la auditoría (próximas iteraciones): partir services/embarque/queries.ts, extraer hooks controller en TrackingLiveCard y dialogs de Auditoría, migrar TabTracking a RHF, y rotar v8/chunks/0.ts.",
  },
  {
    version: "8.136.0",
    date: "2026-05-14",
    type: "minor",
    title: "Tracking: línea de tiempo de fases del embarque",
    summary: "El tab Tracking muestra ahora un stepper con las 5 fases canónicas (Cotización → Confirmado → En Tránsito → Llegada → Cerrado) y notas en la misma vista.",
    description: "Nuevo TrackingFasesTimeline (stepper horizontal en desktop, vertical en móvil) con estado completada/actual/pendiente y fecha por fase. Lógica pura en lib/domain/embarqueFases.ts con tests. TabTracking incluye TabNotas al final.",
  },
  {
    version: "8.135.6",
    date: "2026-05-14",
    type: "patch",
    title: "Refactor UI: early returns para estados de carga",
    summary: "Tarjetas y páginas con loading/empty/contenido usan ahora helpers renderBody() con early returns; el JSX principal queda plano y legible.",
    description: "Refactorizados AuditoriaTendenciaChart, ReportesTopChart, ProximosArribosCard, AlertasDemoraCard, CargasActivasClienteCard, TablaContactos, TabTracking, TabProformasPendientes, Bitacora, Operaciones y Auditoria. Sin cambios visuales.",
  },
  {
    version: "8.135.5",
    date: "2026-05-14",
    type: "patch",
    title: "Refactor UI: ternarios anidados reemplazados por helpers nombrados",
    summary: "18 archivos en components/pages dejan de usar ternarios encadenados; ahora usan helpers reutilizables o funciones locales con if/else.",
    description: "Helpers nuevos en lib/formatters (pluralS, formatDiasCredito) y lib/ui/uiMappings (getNotaTipoColorClass, getDocEstadoColorClass, getStepIndicatorCircleClass, getDiasVencidosTone, getProfitToneClass). Sin cambios visuales.",
  },
  {
    version: "8.135.4",
    date: "2026-05-14",
    type: "patch",
    title: "Optimización: queries de DB lineales y en paralelo",
    summary: "Las exportaciones de embarques, las actualizaciones de configuración y el detalle de cotización del portal ahora hacen sus consultas en paralelo, sin loops secuenciales.",
    description: "fetchEmbarquesParaExport: conteo exacto + Promise.all de páginas. useEmbarquesPageController: chunks de fetchEmbarquesListExtras en paralelo. updateConfiguracionItems / updateConfiguracionGlobalItems: Promise.all en lugar de await en for. fetchPortalCotizacion: join embebido en una sola query. Sin cambios funcionales.",
  },
  {
    version: "8.135.3",
    date: "2026-05-12",
    type: "patch",
    title: "Embarques: avance automático a 'Arribo' al registrar la fecha real de llegada",
    summary: "Aplicar una ATA al embarque mueve el estado a 'Arribo' automáticamente si estaba en 'Confirmado' o 'En Tránsito', y registra el evento 'Arribo a Puerto' en la línea de tiempo.",
    description: "useApplyJsonCargoFechas lee el estado actual y, al aplicar ATA, incluye estado='Arribo' en el mismo UPDATE solo si el estado previo es 'Confirmado' o 'En Tránsito' — nunca retrocede ni sobreescribe estados posteriores. Inserta evento 'Arribo a Puerto' con la fecha ATA, evitando duplicados. Invalida cachés de eventos, detalle y RPC unificado del embarque.",
  },
  {
    version: "8.135.2",
    date: "2026-05-12",
    type: "patch",
    title: "Tracking: ATA inferida también actualiza el ETA del embarque",
    summary: "Al aplicar la ATA inferida desde JSONCargo, el ETA del embarque se alinea a esa fecha cuando no hay un ETA nuevo explícito, para que el tab Resumen refleje la realidad.",
    description: "useApplyJsonCargoFechas escribe eta = ata cuando se aplica ATA sin un eta explícito, e invalida la caché ['embarques','full', id] para refrescar el Resumen. TrackingLiveCard indica '(también se aplicará como ETA)' en el preview cuando aplica.",
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
