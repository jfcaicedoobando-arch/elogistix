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
    version: "8.219.0",
    date: "2026-05-18",
    type: "patch",
    title: "Documentos de embarque — subida sin upsert para evitar falso RLS",
    summary: "Corrige el fallo real de Valeria: Storage aceptaba INSERT pero rechazaba la ruta de upsert como RLS.",
    description: "Se reprodujo el flujo con la sesión de Valeria y un PDF mínimo: la misma ruta funcionaba con upload normal y fallaba con upsert: true. La utilidad uploadFile ahora usa upsert false por defecto; los paths de documentos ya son únicos por hash/nombre sanitizado y la idempotencia se conserva con la validación previa de documentos_embarque. Esto evita que Storage evalúe la operación como UPDATE y bloquee cargas válidas. APP_VERSION 8.219.0.",
  },
  {
    version: "8.218.0",
    date: "2026-05-18",
    type: "patch",
    title: "Documentos de embarque — permiso interno de validación RLS",
    summary: "Corrige el bloqueo de subida de archivos que seguía apareciendo como 'new row violates row-level security policy'.",
    description: "Se restauró el permiso EXECUTE necesario sobre public.can_manage_document_object(text) para el rol usado internamente por Storage durante la inserción de objetos. La regla de negocio no cambia: sólo admin/operador de la organización del embarque o super_admin pueden subir, reemplazar o eliminar documentos. APP_VERSION 8.218.0.",
  },
  {
    version: "8.217.0",
    date: "2026-05-18",
    type: "patch",
    title: "Documentos de embarque — validación RLS con path normalizado",
    summary: "Refuerza la validación de rutas de documentos para aceptar keys con o sin slash inicial durante la evaluación de Storage.",
    description: "Se ajustó public.can_manage_document_object(text) para normalizar la ruta con ltrim(name, '/') y se reaplicaron las políticas del bucket 'documentos' contra la función centralizada. También se concedió ejecución al rol interno de Storage para permitir evaluar la política durante la operación. APP_VERSION 8.217.0.",
  },
  {
    version: "8.216.0",
    date: "2026-05-18",
    type: "minor",
    title: "Toasts de error con panel de detalles copiables",
    summary: "Los toasts destructive ahora muestran 'Ver detalles' con reporte completo copiable para soporte/Lovable.",
    description: "notifyError() arma automáticamente un reporte (versión, ruta, usuario+org+rol, viewport, UA, mensaje + code/status/details/hint, stack y contexto del call site) y lo expone en un Dialog global vía botón 'Ver detalles' o click sobre el toast destructive. Incluye 'Copiar reporte' (markdown) y 'Copiar JSON'. Subida/eliminación de documentos del embarque ahora envían el error original y context (embarqueId, documentoId, fileName, bucket). APP_VERSION 8.216.0.",
  },
  {
    version: "8.215.0",
    date: "2026-05-18",
    type: "patch",
    title: "Subida de documentos — validación RLS centralizada",
    summary: "Corrige el bloqueo persistente al subir documentos con rutas embarqueId/docId para operadores.",
    description: "Se centralizó la validación del bucket 'documentos' en public.can_manage_document_object(name), revisando rol, membresía organizacional y pertenencia real de la ruta al embarque/documento activo. Mantiene aislamiento multi-tenant y permite a operadores como Valeria subir archivos del embarque correcto. APP_VERSION 8.215.0.",
  },
  {
    version: "8.214.0",
    date: "2026-05-18",
    type: "patch",
    title: "Subida de documentos — fix RLS por referencia calificada",
    summary: "Corrige 'new row violates row-level security policy' al subir documentos del embarque.",
    description: "Las políticas del bucket 'documentos' usaban storage.objects.name (referencia calificada) que no se resolvía en WITH CHECK al INSERTar, rechazando toda subida. Se recrearon usando simplemente name. Sin cambios de permisos. APP_VERSION 8.214.0.",
  },
  {
    version: "8.213.0",
    date: "2026-05-18",
    type: "patch",
    title: "Embarque detalle — corrección de pantalla en blanco por breadcrumbs",
    summary: "Se corrigió el loop que dejaba en blanco el detalle del embarque e impedía usar la pestaña Documentos.",
    description: "useRegisterBreadcrumbLabel ya no depende del objeto completo del contexto de breadcrumbs, evitando el cleanup/setState repetido que causaba 'Maximum update depth exceeded' al abrir el detalle. La pestaña Documentos vuelve a renderizarse para poder subir archivos. APP_VERSION 8.213.0.",
  },
  {
    version: "8.212.0",
    date: "2026-05-18",
    type: "minor",
    title: "Dashboard — Profit homologado a MXN con desglose por moneda",
    summary: "El Profit proyectado del Dashboard ahora se muestra en pesos (homologa USD/EUR con el TC de cada embarque) e incluye tooltip con desglose por moneda origen.",
    description: "Se corrigió profit_por_embarque() que solo sumaba conceptos en USD e ignoraba MXN/EUR. Las RPC dashboard_summary/details exponen ventaMXN/costoMXN/profitMXN + desglose. UI: tarjeta 'Arribos este mes' muestra 'Profit MXN proyectado' con tooltip; ProfitTable y resumen del mes siguiente migran a MXN. APP_VERSION 8.212.0.",
  },
  {
    version: "8.211.0",
    date: "2026-05-18",
    type: "patch",
    title: "Errores de Supabase — mensaje legible en toasts",
    summary: "Los errores de RPC/Supabase (PostgrestError) ya no aparecen como 'Error desconocido'; ahora se muestra el mensaje real para diagnosticar fallos al avanzar estado o subir documentos.",
    description: "getErrorMessage() ahora detecta objetos tipo PostgrestError (que no heredan de Error) y compone el mensaje con message + details + hint, o el code si no hay texto. Soluciona los toasts opacos al avanzar_estado_embarque y otras mutaciones. Sin cambios de lógica de negocio. APP_VERSION 8.211.0.",
  },
  {
    version: "8.210.0",
    date: "2026-05-18",
    type: "patch",
    title: "Documentos de embarque — fix RLS para rutas con ID de documento",
    summary: "Corrige el error al subir documentos cuando la ruta usa embarqueId/docId en el bucket de documentos.",
    description: "La subida desde el detalle del embarque guarda archivos bajo 'embarques/<embarqueId>/<docId>/...'. La política anterior no comprobaba el documento específico en esa estructura. Se recrearon las políticas del bucket 'documentos' para aceptar la combinación embarqueId + documentoId validada contra documentos_embarque y embarques de la misma organización. APP_VERSION 8.210.0.",
  },
  {
    version: "8.209.0",
    date: "2026-05-18",
    type: "minor",
    title: "Documentos de embarque — agregar entradas desde el detalle",
    summary: "Nuevo botón 'Agregar documento' en la pestaña Documentos del embarque para crear filas del checklist desde el detalle (estándar por modo o nombre libre).",
    description: "TabDocumentos ahora recibe embarqueId y modo. El header expone 'Agregar documento' (solo canEdit) que abre un diálogo con Select de docs estándar según modo + opción 'Otro' con nombre libre y notas. Nueva mutación useCreateDocumentoEmbarque inserta en documentos_embarque con estado 'Pendiente'. Reseed manual del checklist faltante en ELIMP00216 tras el reintento del bug RLS de v8.207.0. APP_VERSION 8.209.0.",
  },
  {
    version: "8.208.0",
    date: "2026-05-18",
    type: "patch",
    title: "Documentos de embarque — fix RLS de upload para admin y operador",
    summary: "Admin y operador no podían subir documentos a embarques ('new row violates row-level security policy'). Política del bucket re-alineada con la estructura real de paths.",
    description: "Migración 20260518: drop & recreate de las políticas INSERT/UPDATE/DELETE del bucket 'documentos'. La política anterior exigía foldername[1] = organization_id, pero los archivos se guardan bajo 'embarques/<expediente>/...'. Ahora la pertenencia se valida vía EXISTS contra public.embarques (foldername[2] = expediente o id::text) manteniendo el aislamiento multi-tenant. No requiere migrar archivos existentes. APP_VERSION 8.208.0.",
  },
  {
    version: "8.207.0",
    date: "2026-05-18",
    type: "minor",
    title: "Embarques — creador visible en Notas y Actividad",
    summary: "Se registra qué usuario creó cada embarque y se muestra en el timeline de la pestaña Notas y Actividad.",
    description: "Nuevas columnas embarques.created_by y created_by_email rellenadas por trigger BEFORE INSERT (auth.uid() + email). Backfill desde bitacora_actividad (accion='crear'). TabNotas muestra entrada 'Embarque creado' con usuario y fecha al final del timeline. APP_VERSION 8.207.0.",
  },
  {
    version: "8.206.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría P1.6 + P0.2 — utils/ eliminado y cotizacionForm cx15→0",
    summary: "exportOrganizationZip movido a services/admin/exportOrg.ts y carpeta src/utils/ eliminada. partesMercancia dividido (cx 15→0). 0 warnings ESLint.",
    description: "P1.6: borrado shim deprecado src/utils/orgExportZip.ts; exportOrganizationZip vive ahora en services/admin/exportOrg.ts junto a fetchOrganizationExport. TabExportar importa desde @/services/admin. P0.2: partesMercancia (cotizacionForm) dividido en partesMercanciaBase + partesMercanciaMedidas, eliminando el último warning de complejidad en mappers. Sin cambios funcionales. APP_VERSION 8.206.0.",
  },
  {
    version: "8.205.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría P0.4 — Supabase fuera de generators/",
    summary: "Generadores PDF/CSV ahora reciben DTOs hidratados desde services/facturas/exports.ts. layoutContable y estadoCuentaPdf pierden dependencia directa a Supabase.",
    description: "Auditoría arquitectónica P0.4 (plan en .lovable/plan.md): generators/ no debe hacer I/O. Creado services/facturas/exports.ts con fetchLayoutContableData (facturas + RFC) y fetchEstadoCuentaFacturas. generators/layoutContable.ts y generators/estadoCuentaPdf.ts quedan como capa pura de presentación. Sin cambios funcionales ni de BD. APP_VERSION 8.205.0.",
  },
  {
    version: "8.204.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 8 (cierre: 0 warnings ESLint)",
    summary: "8 → 0 warnings ESLint. useTrackingLiveCard, buildGlobal, useCotizacionWizardSteps, usePortalEmbarquesController, BulkImportDialog y auditoria-weekly-digest cerrados.",
    description: "Refactors puros sin cambios funcionales ni de BD. useTrackingLiveCard (19→0) extrae derivePrefixState, handleSyncResult, handleSyncError, buildApplyFechasArgs. useOperacionesData buildGlobal (17→0) extraída del hook con helper n(). useCotizacionWizardSteps handleSiguiente (18→0) divide en handlePaso1/2/3. usePortalEmbarquesController filtered (17→0) extrae embarqueMatchesSearch. BulkImportDialog (273→<200 LOC) mueve UploadStep/PreviewStep a BulkImportSteps.tsx. DimensionesAereasTable/LCLTable: allowlist documentada para Table primitivo (read-only). auditoria-weekly-digest (17→0) extrae resolveAdminEmails/sendDigest/processOrg/unauthorized y tipa con SupabaseClient. 369/369 tests verdes. APP_VERSION 8.204.0.",
  },
  {
    version: "8.203.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 7 (DatosGenerales, Mercancía, Sidebar, BulkImport, proformaPdf)",
    summary: "14 → ~7 warnings ESLint. buildRows, SeccionMercanciaCotizacionDetalle, AppSidebarBase, BulkImportDialog, VirtualDataTable, TrackingWarnings y useCotizacionWizardSteps refactorizados.",
    description: "Refactors puros sin cambios funcionales ni de BD. CotizacionDatosGeneralesCard divide buildRows en baseRows/optionalRows/maritimeRows/seguroRow. SeccionMercanciaCotizacionDetalle extrae MercanciaInfoGrid + DimensionesLCL/AereasTable. ConceptoRowUSD extrae ConceptoDescripcionSelector. TrackingWarnings usa computeAlertFlags. AppSidebar usa useAppSidebarSections + barrel hooks/layout. BulkImportDialog y VirtualDataTable extraen body/footer sub-componentes. proformaPdf dividido en proforma/{styles,header,consolidada}.ts (271→<150 LOC). embarqueWizardSchemas dividido en Constants/Documentos/Costos (257→<200 LOC). useCotizacionWizardSteps simplifica handleSiguiente con validatePaso1 puro. 369/369 tests verdes. APP_VERSION 8.203.0.",
  },
  {
    version: "8.202.0",
    date: "2026-05-18",
    type: "patch",
    title: "Auditoría — P2.12 lote 6 (jsoncargo-track, invite-client-user, TrackingWarnings, proformaPdf)",
    summary: "21 → 14 warnings ESLint. jsoncargo-track, invite-client-user, deriveEventsFromContainer, TrackingWarnings, CotizacionDatosGeneralesCard, buildHeaderHtml y VirtualDataTable refactorizados.",
    description: "Refactors puros sin cambios funcionales ni de BD. jsoncargo-track extrae helpers a _shared/jsoncargoSync.ts. invite-client-user (26→0) extrae parseBody, verifyClienteOrg, resolveUserId, ensureClienteRole. _shared/jsoncargo.ts deriveEventsFromContainer (22→0) dividido en buildZarpe/Movimiento/AduanaEvent. TrackingWarnings.tsx (23→0) extrae 4 sub-componentes de alerta. CotizacionDatosGeneralesCard.tsx (24→0) usa array declarativo. proformaPdf buildHeaderHtml (21→0) extrae sub-secciones. VirtualDataTable extrae VirtualRow, VirtualHeaderRow, SkeletonRows, EmptyState. BulkImportDialog extrae hook useBulkImport. APP_VERSION 8.202.0.",
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
