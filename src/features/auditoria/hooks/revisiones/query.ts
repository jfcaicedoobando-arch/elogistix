import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { fetchAuditoriaRevisiones } from "@/features/auditoria/services";
import { getCurrentUser } from "@/features/auth/services";
import type { AuditoriaRevision } from "@/features/auditoria/types";
import { AUDITORIA_REVISIONES_KEY } from "./hash";

/**
 * Resuelve el usuario autenticado tolerando ventanas de carrera en el
 * hidratado del AuthContext: si `ctxUser` aún no llegó del React state,
 * cae a `getCurrentUser()` (fuente de verdad). Sólo si ambos fallan
 * lanza "Sesión no válida".
 */
export async function resolveAuthUser(ctxUser: User | null): Promise<User> {
  if (ctxUser) return ctxUser;
  return getCurrentUser();
}

/**
 * Construye el Map<key, AuditoriaRevision> desde la lista plana de revisiones.
 * Exportado para que `useAuditoriaCount` (en `useAuditoria.ts`) y este hook
 * compartan EXACTAMENTE la misma queryFn — React Query usa la primera queryFn
 * registrada para un key dado, así que tener dos definiciones distintas era
 * un bug latente dependiente del orden de montaje.
 */
export async function buildRevisionesMap(): Promise<Map<string, AuditoriaRevision>> {
  const list = await fetchAuditoriaRevisiones();
  const map = new Map<string, AuditoriaRevision>();
  for (const r of list) {
    map.set(`${r.embarque_id}|${r.regla}|${r.detalle_hash}`, r);
  }
  return map;
}

export function useAuditoriaRevisiones() {
  return useQuery({
    queryKey: AUDITORIA_REVISIONES_KEY,
    queryFn: buildRevisionesMap,
    // Perf (asesor BD 2026-08-07): este listado era la consulta #1 en tiempo
    // total (9 300 llamadas). Las revisiones cambian sólo cuando el usuario
    // marca un hallazgo, y esas mutaciones invalidan la key explícitamente.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
