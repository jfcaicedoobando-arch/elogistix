import type { ProformaDetalleFull, ProformaFacturaAsociada } from "./queries";

type RawAsociada = ProformaFacturaAsociada & { deleted_at: string | null; created_at: string };

/**
 * Post-procesa el resultado del embed `facturas_asociadas:facturas!proforma_id(...)`
 * de `fetchProformaPorId`: filtra facturas eliminadas lógicamente, ordena por fecha
 * de creación y descarta las columnas auxiliares (`deleted_at`, `created_at`) que
 * sólo se usaron para filtrar/ordenar. Función pura para poder testearla aislada.
 */
export function mergeProformaDetalle(data: unknown): ProformaDetalleFull {
  // SAFE-CAST: PostgREST embed devuelve `unknown`; validamos forma mínima antes de mapear.
  const raw = data as { facturas_asociadas?: RawAsociada[] | null } & Record<string, unknown>;
  const asociadas = (raw.facturas_asociadas ?? [])
    .filter((f) => !f.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ deleted_at: _d, created_at: _c, ...rest }) => rest);
  // SAFE-CAST: reconstruimos el objeto sobre el shape ya conocido de ProformaDetalleFull.
  return { ...(data as Record<string, unknown>), facturas_asociadas: asociadas } as ProformaDetalleFull;
}
