/**
 * Hash determinista (djb2) — debe coincidir embarque_id+regla+detalle entre
 * cliente y backend para detectar duplicados consistentemente.
 */
import type { HallazgoAuditoria } from "@/types/auditoria";

export function hallazgoHash(
  h: Pick<HallazgoAuditoria, "embarque_id" | "regla" | "detalle">,
): string {
  const input = `${h.embarque_id}|${h.regla}|${h.detalle}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function revisionKey(
  h: Pick<HallazgoAuditoria, "embarque_id" | "regla" | "detalle">,
): string {
  return `${h.embarque_id}|${h.regla}|${hallazgoHash(h)}`;
}

// Re-export como factory para retro-compatibilidad con el resto del módulo.
import { queryKeys } from "@/lib/query";
export const AUDITORIA_REVISIONES_KEY = queryKeys.auditoria.revisiones;
