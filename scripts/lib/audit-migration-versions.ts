/**
 * H0 — Unicidad de versión (timestamp) en `supabase/migrations`.
 *
 * Dos archivos con el mismo prefijo de 14 dígitos comparten la misma "version"
 * para `supabase db push`: el orden de aplicación entre ellos es indefinido y
 * una base recién instalada puede quedar con una función distinta a producción.
 *
 * Aplica a TODO el historial (también pre-baseline), con una única excepción
 * legacy exacta y cerrada (ver `COLISION_LEGACY`). No existe patrón amplio:
 * cualquier timestamp duplicado nuevo — o un tercer archivo sobre el timestamp
 * legacy — es violación.
 */
import type { Violation } from "./audit-sql-signatures";

/** Única colisión histórica tolerada. El grupo debe coincidir EXACTAMENTE. */
export const COLISION_LEGACY: { readonly version: string; readonly archivos: readonly string[] } = {
  version: "20260901000100",
  archivos: [
    "20260901000100_cierre_lcl_sin_fechas_contenedor.sql",
    "20260901000100_r4_replay_avanzar_estado_embarque.sql",
  ],
};

const VERSION_RE = /^(\d{14})/;

function esParejaLegacyExacta(version: string, archivos: readonly string[]): boolean {
  if (version !== COLISION_LEGACY.version) return false;
  if (archivos.length !== COLISION_LEGACY.archivos.length) return false;
  const esperados = [...COLISION_LEGACY.archivos].sort();
  const dados = [...archivos].sort();
  return esperados.every((n, i) => n === dados[i]);
}

/** Agrupa nombres `.sql` por sus primeros 14 dígitos. */
export function agruparPorVersion(files: readonly string[]): Map<string, string[]> {
  const grupos = new Map<string, string[]>();
  for (const f of files) {
    if (!f.endsWith(".sql")) continue;
    const version = VERSION_RE.exec(f)?.[1];
    if (!version) continue;
    const arr = grupos.get(version) ?? [];
    arr.push(f);
    grupos.set(version, arr);
  }
  return grupos;
}

/** Reporta una violación H0 por cada timestamp duplicado no exceptuado. */
export function scanVersionesDuplicadas(files: readonly string[]): Violation[] {
  const out: Violation[] = [];
  for (const [version, archivos] of [...agruparPorVersion(files).entries()].sort()) {
    if (archivos.length < 2) continue;
    if (esParejaLegacyExacta(version, archivos)) continue;
    const listado = [...archivos].sort().join(", ");
    out.push({
      file: [...archivos].sort()[0],
      check: "H0",
      detail: `timestamp duplicado ${version} en ${archivos.length} archivos: ${listado}`,
    });
  }
  return out;
}
