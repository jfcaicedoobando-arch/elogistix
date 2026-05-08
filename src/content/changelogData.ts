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
    version: "8.119.0",
    date: "2026-05-08",
    type: "minor",
    title: "Hardening tras code audit externo",
    summary: "Tipado estricto en services/cliente, timeout + fallback en exchange-rates, helpers de CORS con whitelist, doc de seguridad y checklist RLS.",
    description: "Respuesta al audit externo de Greg the Great. (1) src/services/cliente/crud.ts: removidos los 2 `any` (helper genérico dedupeByRfc tipado con Pick<Cliente,'id'|'rfc'>). (2) supabase/functions/exchange-rates: AbortController con timeout 5s + fallback explícito a tipos de cambio default; logs de fallback para diagnóstico. (3) supabase/functions/_shared/cors.ts: nuevo buildCors(req) con whitelist (*.lovable.app, *.lovableproject.com, localhost) y handlePreflightStrict; jsonResponse/errorResponse aceptan override de cors. Wildcard se mantiene como default (endpoints públicos por diseño + auth real vía JWT en authenticate()). (4) supabase/functions/parse-csf: documentado en cabecera que NO parsea XML (descarta superficie XXE). (5) docs/security-checklist.md: nuevo documento operativo con queries para verificar cobertura RLS, search_path en SECURITY DEFINER, fuerza del token de tracking_links, mapa de edge functions y política Lovable (no rate limiting backend, anon key es pública por diseño). Hallazgos del audit descartados con justificación: rotar anon key (es pública), .env en .gitignore (Lovable lo gestiona), rate limiting backend (no soportado), GitHub Actions CI (Lovable corre el pipeline). Versión 8.119.0.",
  },
  {
    version: "8.118.8",
    date: "2026-05-06",
    type: "patch",
    title: "Auditoría de tests: arreglo de test obsoleto en parsers/dashboard",
    summary: "Revisión de la suite (278 tests). Se actualiza el test desactualizado de parseCargasPorCliente para reflejar la normalización del desglose.",
    description: "30 archivos / 278 tests revisados. Test rojo: parseCargasPorCliente esperaba desglose vacío pero el parser ya normaliza con las 5 llaves de estado en 0. Reemplazado por 2 casos: uno valida la normalización con desglose vacío y otro confirma que se conservan los conteos cuando vienen poblados. Sin tests redundantes detectados; sin borrar nada. 14/14 verdes en dashboard.test.ts.",
  },
  {
    version: "8.118.7",
    date: "2026-05-06",
    type: "patch",
    title: "Tests de borde: helpers financieros y reglas de Auditoría",
    summary: "23 nuevos tests cubren conversiones MXN/USD/EUR, montos negativos, tasas extremas, NaN, ETAs nulas, datos ausentes y score saturado.",
    description: "financialUtils.edge.test.ts (16) cubre round-trip de monedas, EUR vía MXN, defaults, negativos, IVA 0, calcularMargen(0,0), sumarEnUSD multi-moneda y calcularTotalesPL sin NaN. useAuditoriaEjecutivo.edge.test.tsx (7) cubre data undefined, ETAs nulas, monto_mxn ausente, cliente/estado vacíos, ausencia de revisiones (MTTR=null) y score saturado a 0.",
  },
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
