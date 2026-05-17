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
    version: "8.184.0",
    date: "2026-05-17",
    type: "minor",
    title: "E2E Playwright (Bloque 2.3): scaffolding + 5 flujos críticos",
    summary: "Smoke tests E2E listos para go-live: login, embarques, facturación, conciliación y portal cliente.",
    description: "Bloque 2.3 cerrado. Se agrega 'playwright.config.ts' (es-MX, America/Mexico_City, retries en CI, traces/screenshots on failure) y carpeta 'e2e/' con fixtures de auth y 5 specs smoke (01 login interno + error, 02 embarques listado/detalle, 03 facturación tabs, 04 proformas/conciliación, 05 portal cliente). La carpeta queda fuera del bundle y de 'tsconfig.app.json' para no exigir '@playwright/test' al build; se instala on-demand con 'npm i -D @playwright/test && npx playwright install chromium'. Variables E2E_BASE_URL/E2E_EMAIL/E2E_PASSWORD/E2E_PORTAL_* documentadas en 'e2e/README.md'. Cero impacto en runtime y en los 334 unit tests existentes.",
  },
  {
    version: "8.183.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.5 — Bitácora virtualizada con tamaño de página",
    summary: "Nuevo selector de 30/60/120/300 en /bitacora; al pasar de 60 filas se activa @tanstack/react-virtual para mantener el scroll fluido.",
    description: "BitacoraActividad expone virtualize+maxHeight (default 600px) y la página /bitacora alterna automáticamente entre render lineal y virtualizado según el tamaño cargado. APP_VERSION 8.183.0."
  },
  {
    version: "8.182.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.2 — Validación zod en mutaciones",
    summary: "Nuevos schemas zod en cliente, cotización, embarque y notas validan los payloads antes de tocar la base; parseOrThrow surface errores legibles.",
    description: "src/lib/validation/mutationSchemas.ts centraliza la última red de seguridad antes de los inserts/updates: createCliente, updateCliente, crearCotizacion, crearEmbarqueRpc, insertarNotaEmbarque e insertarNotaCambioEstado pasan por parseOrThrow. 15 tests nuevos verdes. APP_VERSION 8.182.0."
  },
  {
    version: "8.181.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.4 — N+1 fase 2 en cotizaciones, clientes y proveedores",
    summary: "RPCs *_listado con agregados (embarques, cotizaciones, deuda, operaciones, pendiente) eliminan llamadas extra desde la UI.",
    description: "cotizaciones_listado, clientes_listado y proveedores_listado siguen el patrón de B.4 con SECURITY INVOKER. fetchClientesPaginados y fetchProveedoresPaginados ahora consumen las RPCs y devuelven ítems enriquecidos sin romper consumidores. fetchCotizacionesListado se expone para futuras pantallas paginadas. APP_VERSION 8.181.0."
  },
  {
    version: "8.180.0",
    date: "2026-05-17",
    type: "minor",
    title: "Bloque 2.1 — Crashes de UI reportados a app_logs",
    summary: "Edge function client-error-log + ErrorBoundary: cualquier excepción en la UI se persiste con fn='client' y dispara alertas internas si se repite.",
    description: "client-error-log (verify_jwt=false) recibe {message, stack, component_stack, route, user_agent, app_version}, captura user_id desde JWT cuando existe e inserta en app_logs como error status 500. ErrorBoundary lo invoca fire-and-forget en componentDidCatch (excepto en ChunkLoadError, que sigue recargando). ≥5 crashes en 5 min disparan alerta automática vía el cron existente. APP_VERSION 8.180.0."
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
