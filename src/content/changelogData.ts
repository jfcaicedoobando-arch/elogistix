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
