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
    version: "8.198.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 endurecimiento de complejidad",
    summary: "30 → 23 warnings ESLint. validateStepRuta/Costos, diffConceptos, agruparPorExpediente y useEmbarqueDetalleData refactorizados con helpers extraídos.",
    description: "P2.12 Endurecimiento de complejidad ciclomática (post P2.10). Refactors puros, sin cambios funcionales: lib/domain/embarqueWizardSchemas.ts — validateStepRuta (28→0) extrae validateMaritimoRuta/Aereo/Terrestre y validateRutaModo; validateStepCostos (16→0) extrae parseTC, validarConceptosVenta y validarConceptosCosto. lib/audit/diffFields.ts — diffConceptos (17→0) extrae nombreOf y compararConcepto. lib/domain/proyeccionFacturacion.ts — agruparPorExpediente (19→0) extrae initGrupo y mergeFila. hooks/embarque/useEmbarqueDetalleData.ts (17→0) usa helpers tc() y pick() para tipos de cambio y defaults `?? []`. 369/369 tests verdes. APP_VERSION 8.198.0.",
  },
  {
    version: "8.197.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.10 + cierre Sprint 3",
    summary: "useToast/useIsMobile re-exportados desde hooks/shared para uniformidad. recentChangelog trimmed a 10 entradas (bundle).",
    description: "P2.10 Hooks compartidos: nuevos wrappers `hooks/shared/useToast.ts` y `hooks/shared/useIsMobile.ts` re-exportan los hooks canónicos shadcn (`@/hooks/use-toast`, `@/hooks/use-mobile`) bajo el barrel `hooks/shared`. Se conservan los módulos raíz por convención shadcn — los nuevos consumidores pueden importarlos desde el barrel. Mantenimiento: `recentChangelog` recortado de 11 a 10 entradas para mantener pequeño el chunk lazy (test `<= 10` pasa). 369/369 tests verdes. APP_VERSION 8.197.0.",
  },
  {
    version: "8.196.0",
    date: "2026-05-18",
    type: "minor",
    title: "Auditoría — P0.3 (pages) + P1.8 (tests de servicios)",
    summary: "43 → 41 warnings, 359 → 369 tests. TrackingPublico/Embarques/EmbarqueDetalle partidos en sub-componentes; nuevos hooks useTabsParam y useEmbarqueDetalleData.",
    description: "P0.3 Pages: TrackingPublico, Embarques y EmbarqueDetalle bajan a 0 warnings de complejidad extrayendo sub-componentes (TrackingPublicoTimeline, EmbarquesHeaderActions, LoadingState/NotFoundState) y hooks (useTabsParam genérico para query param, useEmbarqueDetalleData que centraliza defaults). P1.8 Tests: nuevas suites para navieras mapper (5), embarqueRoundtrip (3) y cotizacionPaso1 (3). 369/369 verdes. APP_VERSION 8.196.0.",
  },
  {
    version: "8.195.0",
    date: "2026-05-18",
    type: "minor",
    title: "Auditoría arquitectónica — P0.3, P1.5, P1.6, P2.11 cerrados",
    summary: "51 → 35 warnings ESLint. Mappers y servicios partidos en sub-helpers por sección, utils unificados, mapa de arquitectura documentado.",
    description: "P0.3 Mappers refactor: embarqueFromDb/ToDb, cotizacion y cotizacionForm divididos en helpers por sección con nuevo `lib/mappers/_helpers.ts` (str/num/bool/emptyToNull). jsoncargo/navieras usa tabla iterable en lugar de cadena de if. P1.6 Servicios: facturas/proyeccion, facturas/huecoFacturacion y cotizacion/mutations partidos en sub-funciones fetch/index/construir. P1.5 Utils: lib/utils.ts plano eliminado, todo bajo lib/utils/ con barrel. P2.11 Nuevo docs/architecture-map.md con mapa dominio → capas. 359/359 tests verdes. APP_VERSION 8.195.0.",
  },
  {
    version: "8.193.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría arquitectónica — P0.2 (Supabase fuera de pages/components)",
    summary: "Plan completo de auditoría documentado y primer paso implementado: 3 archivos UI que llamaban a Supabase directamente ahora pasan por servicios dedicados.",
    description: "Auditoría read-only del repo (637 archivos, 265 warnings ESLint, 0 errores) plasmada en .lovable/plan.md con plan priorizado de 4 sprints. Implementado P0.2: extraídas las llamadas Supabase directas de pages/components a la capa de servicio. Nuevos archivos: services/admin/papelera.ts (listTrash, restoreRecord, purgeRecord), services/admin/idempotencia.ts (listIdempotencyLog) y services/observability/{index,logClientError}.ts. Actualizados: pages/dashboard/Papelera.tsx, pages/dashboard/Idempotencia.tsx y components/shared/ErrorBoundary.tsx. Reducidas a 0 las llamadas directas a @/integrations/supabase/client desde components/pages (eran 3). 359/359 tests verdes. APP_VERSION 8.193.0.",
  },
  {
    version: "8.192.0",
    date: "2026-05-17",
    type: "minor",
    title: "Sprint A.5 — Export ZIP por organización",
    summary: "Nueva pestaña 'Exportar' en Configuración que descarga un ZIP con CSVs de las 18 tablas operativas de la organización, con barra de progreso y procesamiento 100% en el navegador.",
    description: "Se agregan jszip y file-saver. src/utils/orgExportZip.ts pagina cada tabla en bloques de 1000 filas (límite Supabase), serializa a CSV (RFC 4180 simplificado, escape de comillas y newlines), incluye manifest.json y comprime con DEFLATE nivel 6. Nueva pestaña /configuracion → Exportar (TabExportar) con botón 'Descargar ZIP', barra de progreso (Progress de shadcn) que muestra tabla actual y filas acumuladas, y toast de éxito/error. Tablas incluidas: clientes, proveedores, contactos, embarques, conceptos costo/venta, documentos, eventos, notas, cotizaciones y costos, facturas y conceptos, proformas, bitácora, configuración, notificaciones cliente. RLS garantiza aislamiento por organización + filtro explícito eq('organization_id'). APP_VERSION 8.192.0.",
  },
  {
    version: "8.191.0",
    date: "2026-05-17",
    type: "minor",
    title: "Sprint A — Hardening pre go-live (A.1, A.2, A.3, A.4)",
    summary: "Cierre de 20 warnings críticos del linter (anon ejecución de RPCs), HIBP activado, signups deshabilitados, nueva página /ayuda con glosario y FAQ, checklist de simulacro de restore.",
    description: "A.1 Linter: REVOKE EXECUTE FROM PUBLIC en 23 funciones SECURITY DEFINER (anon ya no puede invocarlas); GRANT a authenticated sólo en RPCs legítimos; revocación total en triggers (congelar_factura_al_emitir, notif_cli_on_embarque_estado, sync_*). Pasamos de 71 a 51 warnings; los restantes son advisory para 'authenticated SECURITY DEFINER' necesarios para bypassear RLS (has_role, RPCs transaccionales). A.2 Auth: configure_auth con password_hibp_enabled=true, disable_signup=true, external_anonymous_users_enabled=false, auto_confirm_email=false. A.3 Backups: docs/backups-rollback.md extendido con checklist de simulacro (5 pasos: preparación, restore, validación, métricas RTO/RPO, limpieza) + plan de comunicación incidente. A.4 Ayuda: nueva ruta /ayuda + sidebar item con HelpCircle. src/content/ayudaContent.ts (16 términos glosario + 18 FAQs en 4 módulos: embarques, facturación, clientes, operación diaria). Búsqueda en vivo, tabs Glosario/FAQ, accordions. A.5 (export ZIP org) diferido a próxima iteración por dependencia jszip. APP_VERSION 8.191.0.",
  },
  {
    version: "8.190.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 3.2 — Layout contable para el contador",
    summary: "Nuevo botón 'Layout contable' en Pre-Facturación → Facturas que descarga un CSV con RFC del cliente, subtotal, IVA, total, moneda, tipo de cambio y campos pre-CFDI 4.0 (uso CFDI, forma/método de pago).",
    description: "Se agrega src/generators/layoutContable.ts que toma las facturas filtradas, consulta en una sola llamada los campos completos (subtotal, iva, tipo_cambio, referencia_bl) y los RFC de los clientes, y descarga un CSV con encabezados pensados para que el contador timbre con su PAC o lo importe a su sistema contable: Folio, Fecha emisión, Periodo (YYYY-MM), Tipo comprobante (I), RFC receptor, Razón social, Subtotal, IVA, Total, Moneda, Tipo de cambio, Forma de pago, Método de pago (PUE), Uso CFDI (G03), Expediente, Referencia BL, Estado. No timbra ni genera XML CFDI 4.0 (requiere PAC externo). Integrado en useFacturacionPageController + Facturacion.tsx (tab Facturas) con registro en bitácora (accion=exportar). APP_VERSION 8.190.0.",
  },
  {
    version: "8.189.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 3.3 — Notificaciones al cliente en el portal",
    summary: "El portal del cliente ahora tiene campanita con contador de no leídas; cada cambio de estado de un embarque del cliente genera automáticamente una notificación.",
    description: "Nueva tabla public.notificaciones_cliente con RLS que sólo deja al cliente leer/marcar las suyas y al staff de la organización crearlas y verlas. Trigger trg_notif_cli_embarque_estado en public.embarques inserta automáticamente una notificación cuando cambia el campo estado, con título legible, mensaje 'antes → después' y URL de portal al detalle. RPCs notificacion_cliente_marcar_leida(p_id) y notificaciones_cliente_marcar_todas_leidas() (SECURITY DEFINER + REVOKE PUBLIC) marcan como leídas sólo registros del propio cliente. Nuevo hook src/hooks/portal/useNotificacionesCliente.ts (react-query, refetchInterval 60s, staleTime 30s) + componente PortalNotificationsBell con badge rojo de no leídas, dropdown de 50 últimas, marcar todas y navegación al recurso. Montado en PortalHeader entre ThemeToggle y el menú de usuario. APP_VERSION 8.189.0.",
  },
  {
    version: "8.188.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 3.6 ext — Diff de costos/ventas al editar embarque",
    summary: "Editar un embarque ahora registra en bitácora qué campos cambiaron y cuántos conceptos de costo/venta se agregaron, eliminaron o modificaron.",
    description: "Se extiende src/lib/audit/diffFields.ts con SENSITIVE_FIELDS.embarque (cliente, modo, tipo, incoterm, naviera, contenedor, BL master/house, puertos, ETD/ETA, estado, consignatario, notificar) y diffConceptos(before, after) que empareja por (nombre+proveedor_id), calcula monto total (monto o precio×cantidad) y devuelve { agregados, eliminados, modificados, detalle[] }. useEditarEmbarqueWizard.handleSave calcula los tres diffs antes del mutateAsync y los persiste en detalles.cambios; si no hubo cambios reales no contamina el log. APP_VERSION 8.188.0.",
  },
  {
    version: "8.188.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 3.6 ext — Diff de costos/ventas al editar embarque",
    summary: "Editar un embarque ahora registra en bitácora qué campos cambiaron y cuántos conceptos de costo/venta se agregaron, eliminaron o modificaron.",
    description: "Se extiende src/lib/audit/diffFields.ts con SENSITIVE_FIELDS.embarque (cliente, modo, tipo, incoterm, naviera, contenedor, BL master/house, puertos, ETD/ETA, estado, consignatario, notificar) y diffConceptos(before, after) que empareja por (nombre+proveedor_id), calcula monto total (monto o precio×cantidad) y devuelve { agregados, eliminados, modificados, detalle[] }. useEditarEmbarqueWizard.handleSave calcula los tres diffs antes del mutateAsync y los persiste en detalles.cambios; si no hubo cambios reales no contamina el log. APP_VERSION 8.188.0.",
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
