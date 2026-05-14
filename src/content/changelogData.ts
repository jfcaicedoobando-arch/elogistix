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
  {
    version: "8.135.1",
    date: "2026-05-12",
    type: "patch",
    title: "Tracking: Actualizar embarque valida persistencia e infiere ATA sin discharging_port",
    summary: "El botón 'Actualizar embarque' del panel JSONCargo confirma que el UPDATE realmente se aplicó (evita falsos éxitos por RLS) y la heurística de ATA cubre casos en que JSONCargo no reporta discharging_port pero el estado dice descarga en puerto.",
    description: "useApplyJsonCargoFechas usa .select('id') y lanza error si no se actualizó ninguna fila. extractSummary y pickEffectiveAta amplían la inferencia: si discharging_port viene vacío pero container_status menciona 'Port of Discharge', 'from vessel', 'at port' o 'at terminal' junto a un patrón de descarga, se toma timestamp_of_last_location como ATA. Caso real ELIMP00203 / TEMU7687933 (ZIM).",
  },
  {
    version: "8.135.0",
    date: "2026-05-11",
    type: "minor",
    title: "Tracking: ATA inferida cuando la naviera no la reporta",
    summary: "Si el contenedor ya está descargado/disponible en el puerto destino y la naviera no entrega ATA explícito, se propone la fecha del último movimiento como fecha de arribo real del embarque.",
    description: "pickEffectiveAta infiere ATA cuando last_location coincide con discharging_port y el estado indica descargado/disponible/entregado/liberado. jsoncargo-track devuelve ata_propuesta y ata_is_inferred; useApplyJsonCargoFechas escribe embarques.fecha_llegada_real. TrackingLiveCard muestra la propuesta con badge 'Inferida del último movimiento'.",
  },
  {
    version: "8.134.1",
    date: "2026-05-11",
    type: "patch",
    title: "JSONCargo: prefixes de leasing pool aceptan todas las navieras",
    summary: "Contenedores con prefix de leasing pool (TEMU, TCLU, TGBU, BEAU, etc.) ya no se bloquean al sincronizar con ZIM, COSCO, HMM, Yang Ming o PIL.",
    description: "El catálogo local de prefixes limitaba los pools de leasing (Triton, Textainer, Beacon, Genstar, SeaCo, Florens) a 6 navieras y bloqueaba el botón Sincronizar para casos válidos como TEMU+ZIM. Ahora estos prefixes mapean a las 11 navieras soportadas por JSONCargo y la validación final la hace el API.",
  },
  {
    version: "8.134.0",
    date: "2026-05-09",
    type: "minor",
    title: "Embarques: ETD/ETA original (cotizado) vs actual",
    summary: "El resumen del embarque conserva y muestra el ETD/ETA cotizado al cliente junto al actual, con la variación en días.",
    description: "Nuevas columnas etd_original/eta_original en embarques (backfill desde etd/eta y trigger de auto-relleno en INSERT). TabResumen muestra la fecha vigente con un badge 'Original: dd MMM yyyy (±Nd)' cuando difiere, manteniendo intacto el dato cotizado aún cuando se actualiza ETD/ETA desde JSONCargo o manualmente.",
  },
  {
    version: "8.133.1",
    date: "2026-05-09",
    type: "patch",
    title: "Tracking: ETD estimado cuando JSONCargo no reporta atd_origin",
    summary: "Si el contenedor ya está cargado en el buque y JSONCargo no devuelve atd_origin, se infiere el ETD desde el último movimiento y se etiqueta como '(estimado)'.",
    description: "pickEffectiveEtd en _shared/jsoncargo.ts y extractSummary del hook aplican la misma heurística (last_movement_timestamp / timestamp_of_last_location) cuando container_status indica zarpe. TrackingLiveCard muestra el ETD efectivo con tooltip y la propuesta de actualizar embarques.etd usa este valor.",
  },
  {
    version: "8.133.0",
    date: "2026-05-09",
    type: "minor",
    title: "JSONCargo: sincronización de ETA/ETD con confirmación",
    summary: "Tracking propone actualizar ETD/ETA del embarque cuando JSONCargo reporta fechas distintas; ya no se sobreescriben automáticamente.",
    description: "jsoncargo-track devuelve etd_propuesta/eta_propuesta y flags de diferencia. TrackingLiveCard muestra una tarjeta de propuesta con botones 'Actualizar embarque' / 'Ignorar' que escribe embarques.etd/eta vía useApplyJsonCargoFechas. Cron batch deja de pisar ETA en silencio.",
  },
  {
    version: "8.132.5",
    date: "2026-05-09",
    type: "patch",
    title: "JSONCargo: prefixes de leasing pool no bloquean tracking",
    summary: "Pools BEAU/TEMU/TCLU/TRHU/GLDU ahora permiten cualquier naviera soportada.",
    description: "containerPrefixes.ts: prefixes de leasing aceptan MAERSK/MSC/EVERGREEN/ONE/CMA_CGM/HAPAG_LLOYD para no bloquear contenedores reales que sí están en JSONCargo.",
  },
  {
    version: "8.132.4",
    date: "2026-05-09",
    type: "patch",
    title: "JSONCargo: reconocer SCAC EGLV como Evergreen",
    summary: "Embarques con naviera 'EGLV' ahora se mapean correctamente a Evergreen.",
    description: "mapNavieraToJsonCargo y NAVIERA_MAP reconocen 'eglv' (SCAC Evergreen) y lo rutean a EVERGREEN.",
  },
  {
    version: "8.132.3",
    date: "2026-05-09",
    type: "patch",
    title: "WHLC: actualizar URL de tracking externo",
    summary: "El link de Wan Hai Lines ahora apunta a la página oficial tracking_query.xhtml.",
    description: "externalTracking.ts: WHLC abre https://www.wanhai.com/views/cargo_track_v2/tracking_query.xhtml.",
  },
  {
    version: "8.132.2",
    date: "2026-05-09",
    type: "patch",
    title: "Tracking externo para navieras no soportadas por JSONCargo",
    summary: "WHLC/Wan Hai, ANL, SITC, Heung-A y otras: el tab Tracking ahora ofrece un link directo al sitio oficial del transportista.",
    description: "Nuevo catálogo externalTracking.ts y botón 'Abrir tracking en {Naviera}' en TrackingLiveCard cuando JSONCargo no soporta la naviera. Fallback a Track-Trace si no hay match conocido.",
  },
  {
    version: "8.132.1",
    date: "2026-05-09",
    type: "patch",
    title: "JSONCargo: rutear OOCL/OOLU como COSCO",
    summary: "Embarques OOCL/OOLU se trackean en JSONCargo bajo COSCO (su matriz). Reaparecen los botones Sincronizar y Buscar por BL Master.",
    description: "mapNavieraToJsonCargo y NAVIERA_MAP reconocen oocl/oolu/oocu/orient overseas y los mapean a COSCO.",
  },
  {
    version: "8.132.0",
    date: "2026-05-09",
    type: "minor",
    title: "JSONCargo: búsqueda de contenedores por BL Master",
    summary: "Nuevo botón en Tracking para consultar JSONCargo por BL Master, elegir un contenedor de la lista y sincronizar tracking en un solo paso.",
    description: "Edge function jsoncargo-bol-lookup que devuelve los contenedores asociados a un BL. DialogBolContainers en el tab Tracking deja seleccionar uno y lo guarda en el embarque + dispara sync. Solo embarques marítimos con naviera soportada.",
  },
  {
    version: "8.131.0",
    date: "2026-05-09",
    type: "minor",
    title: "JSONCargo: validación local de prefix vs naviera",
    summary: "Validación previa del prefix BIC del contenedor antes de llamar a JSONCargo, con sugerencias de naviera cuando no coincide.",
    description: "Catálogo local de prefixes (TEMU, MSCU, MAEU, etc.) → naviera. Si el prefix no coincide con la naviera registrada, NO se consume cuota del API: se muestra error claro con badges de la naviera real sugerida. Edge function devuelve 422 con error_code='PREFIX_MISMATCH'. El cron diario (jsoncargo-track-batch) salta esos embarques y los registra en bitácora.",
  },
  {
    version: "8.130.0",
    date: "2026-05-09",
    type: "minor",
    title: "Tracking automático de contenedores con JSONCargo",
    summary: "Sincronización en vivo del tracking marítimo (estado, vessel, ETA) con autopoblado del timeline.",
    description: "Edge functions jsoncargo-track (manual) y jsoncargo-track-batch (cron diario) consultan la API JSONCargo, guardan en tracking_externo y derivan eventos en el timeline. Card 'Tracking en vivo' en TabTracking y portal del cliente. Auto-sync al editar embarque marítimo. 11 navieras soportadas.",
  },
  {
    version: "8.129.4",
    date: "2026-05-09",
    type: "patch",
    title: "Embarques Relacionados: embarque actual primero, resto por contenedor",
    summary: "El embarque actual aparece como primera fila; el resto se ordena por número de contenedor.",
    description: "fetchEmbarquesRelacionados ordena por contenedor; TabResumen aplica sort estable que pone al embarque actual al inicio.",
  },
  {
    version: "8.129.3",
    date: "2026-05-09",
    type: "patch",
    title: "Embarques Relacionados: tabla mejorada con totales y fila destacada",
    summary: "Se quitó Shipper; se agregaron Peso/Volumen/Piezas, totales y resaltado del embarque actual.",
    description: "fetchEmbarquesRelacionados incluye peso/volumen/piezas y al embarque actual; TabResumen consolida BL Master con resumen y footer de totales.",
  },
  {
    version: "8.129.2",
    date: "2026-05-09",
    type: "patch",
    title: "Embarques Relacionados: columna Contenedor en lugar de Cliente",
    summary: "Se reemplazó la columna Cliente por Contenedor (con tipo entre paréntesis) en la tarjeta de embarques relacionados.",
    description: "fetchEmbarquesRelacionados selecciona contenedor/tipo_contenedor; TabResumen muestra `contenedor (tipo)` en la columna nueva.",
  },
  {
    version: "8.129.1",
    date: "2026-05-09",
    type: "patch",
    title: "Embarques: orden por defecto por número de expediente",
    summary: "El listado ahora muestra primero el embarque más nuevo (expediente desc) con la flecha visible en el header.",
    description: "Estado inicial sortKey='expediente', sortDir='desc' en useEmbarquesPageState. Tiebreaker secundario por created_at desc en fetchEmbarquesPaginados para orden estable cuando hay expedientes duplicados (LCL).",
  },
  {
    version: "8.129.0",
    date: "2026-05-08",
    type: "minor",
    title: "Fase E (parcial): noImplicitAny activado, strict completo evaluado",
    summary: "`noImplicitAny: true` activado: 0 errores. Strict completo evaluado: solo 3 errores de strictFunctionTypes en wrappers de RQ/RHF; pospuesto para no agregar boilerplate innecesario.",
    description: "tsconfig.json y tsconfig.app.json: noImplicitAny=true (0 errores, ningún `any` implícito en el proyecto). Probado strict=true: solo 3 errores reales (EditarCotizacion, NuevaCotizacion y Proveedores), todos por strictFunctionTypes en props que envuelven mutations/handlers de React Query y RHF; el costo de refactorizar firmas para satisfacer contravariancia no compensa el beneficio. Quedan strict=false con strictNullChecks+noImplicitAny=true como configuración estable. Suite 285/285 verde.",
  },
  {
    version: "8.127.0",
    date: "2026-05-08",
    type: "minor",
    title: "Fase B.2 audit casts: validación runtime con Zod en boundaries",
    summary: "`fromDb` acepta schema Zod opcional. Adoptado en RPCs de embarque y joins del portal: si el shape cambia, ZodError en vez de undefined silencioso.",
    description: "Nueva sobrecarga fromDb(data, schema) que valida con Zod. Adoptado en crearEmbarqueRpc, duplicarEmbarqueRpc, fetchPortalClienteName, fetchPortalOrgName. 6 tests nuevos en cast.test.ts. Suite 285/285 verde.",
  },
  {
    version: "8.126.0",
    date: "2026-05-08",
    type: "patch",
    title: "Fase C audit casts: 0 `as Tables<>` fuera de mappers/queries",
    summary: "Eliminados los 2 únicos `as Tables<>` fuera de zona permitida. Política Phase C cumplida.",
    description: "PortalCotizacionDetalle: narrowing local en lugar de cast a tabla. conversiones/embarques: boundary canalizado por fromDb. Audit: 457 casts, 0 CRITICAL, HIGH solo en mocks de tests.",
  },
  {
    version: "8.125.0",
    date: "2026-05-08",
    type: "minor",
    title: "Fase B.1 audit casts: helper fromDb/toDbJson centraliza boundary",
    summary: "Nuevo src/lib/supabase/cast.ts con fromDb<T>() y toDbJson() reemplaza ~50 `as unknown as X` en services/contexts.",
    description: "Helper centralizado para boundary Supabase↔dominio. Migración en 17 archivos. HIGH casts: 64→~15 (resto son mocks de tests). Listo para reemplazar por Zod en Fase B.2 cambiando un solo archivo.",
  },
  {
    version: "8.124.0",
    date: "2026-05-08",
    type: "patch",
    title: "Fase A audit casts: 0 CRITICAL reales (falsos positivos eliminados)",
    summary: "El audit ahora ignora strings y descripciones de changelog. Resultado: 0 `as any` en código ejecutable.",
    description: "Cierre de Fase A del roadmap. scripts/audit-casts.ts elimina strings y excluye content/changelog antes de scanear. Total: 507 casts (vs 559), 0 CRITICAL (vs 9), 64 HIGH, 316 MEDIUM, 7 LOW, 120 SAFE. Próximo: Fase B (reducir HIGH con type guards/Zod en services).",
  },
  {
    version: "8.123.0",
    date: "2026-05-08",
    type: "minor",
    title: "Audit de type assertions: script + roadmap a strictNullChecks",
    summary: "Nuevo `npm run audit:casts` clasifica los 559 `as` casts en 5 niveles. Solo 73 (~13%) requieren acción. Roadmap de 4 fases para llegar a strictNullChecks.",
    description: "Script de auditoría (scripts/audit-casts.ts), reporte generado (docs/cast-audit.md), roadmap (docs/strict-mode-roadmap.md) y política en ARCHITECTURE.md §17.b. Baseline: SAFE 163, LOW 7, MEDIUM 316, HIGH 64, CRITICAL 9.",
  },
  {
    version: "8.122.0",
    date: "2026-05-08",
    type: "minor",
    title: "PR-3 audit calidad: tsconfig endurecido (lints sin uso)",
    summary: "noUnusedLocals/Parameters/noFallthroughCasesInSwitch activados. Limpieza de imports y parámetros muertos en 16 archivos.",
    description: "Tercer PR del audit. Lints de TS endurecidos en tsconfig.app.json y tsconfig.json. strict/strictNullChecks quedan pendientes (ARCHITECTURE.md). Limpieza de unused vars/imports en 16 archivos. Suite 279/279 verde.",
  },
  {
    version: "8.121.0",
    date: "2026-05-08",
    type: "minor",
    title: "PR-2 audit calidad: separación lógica/presentación en TabProformas",
    summary: "useTabProformasController deja de devolver JSX. Las columnas viven en components/facturacion/proformasColumns.tsx; el hook expone solo datos y handlers.",
    description: "Segundo PR del audit de arquitectura. Refactor de useTabProformasController para respetar separación lógica/presentación. Nuevo proformasColumns.tsx con buildProformasColumns(). Hook renombrado de .tsx a .ts; expone datos + handlers (descargar, downloadingId, setProformaAFacturar). TabProformas compone columnas vía useMemo. Versión 8.121.0.",
  },
  {
    version: "8.120.0",
    date: "2026-05-08",
    type: "minor",
    title: "PR-1 audit calidad: shim @/types/db, barrel use-toast y APP_ROLES",
    summary: "14 archivos de components/pages dejan de importar de integrations/. Nuevo shim de tipos DB, barrel re-export de use-toast y constante APP_ROLES.",
    description: "Primer PR del audit de arquitectura. Layer violations resueltas con shim '@/types/db' (re-exporta Tables/Enums/Insert/Update). use-toast accesible desde '@/hooks/shared'. Constante APP_ROLES tipada lista para reemplazar literales en futuras iteraciones. Hallazgos NO accionados con justificación documentada en chunk0.",
  },
  {
    version: "8.119.0",
    date: "2026-05-08",
    type: "minor",
    title: "Hardening tras code audit externo",
    summary: "Tipado estricto en services/cliente, timeout + fallback en exchange-rates, helpers de CORS con whitelist, doc de seguridad y checklist RLS.",
    description: "Respuesta al audit externo de Greg the Great. (1) src/services/cliente/crud.ts: removidos los 2 `any` (helper genérico dedupeByRfc tipado con Pick<Cliente,'id'|'rfc'>). (2) supabase/functions/exchange-rates: AbortController con timeout 5s + fallback explícito a tipos de cambio default; logs de fallback para diagnóstico. (3) supabase/functions/_shared/cors.ts: nuevo buildCors(req) con whitelist (*.lovable.app, *.lovableproject.com, localhost) y handlePreflightStrict; jsonResponse/errorResponse aceptan override de cors. Wildcard se mantiene como default (endpoints públicos por diseño + auth real vía JWT en authenticate()). (4) supabase/functions/parse-csf: documentado en cabecera que NO parsea XML (descarta superficie XXE). (5) docs/security-checklist.md: nuevo documento operativo con queries para verificar cobertura RLS, search_path en SECURITY DEFINER, fuerza del token de tracking_links, mapa de edge functions y política Lovable (no rate limiting backend, anon key es pública por diseño). Hallazgos del audit descartados con justificación: rotar anon key (es pública), .env en .gitignore (Lovable lo gestiona), rate limiting backend (no soportado), GitHub Actions CI (Lovable corre el pipeline). Versión 8.119.0.",
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
