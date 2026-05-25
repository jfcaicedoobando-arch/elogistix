import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchAuditoriaRevisiones } from "@/services/auditoria";
import type { AuditoriaRevision } from "@/types/auditoria";
import { AUDITORIA_REVISIONES_KEY } from "./hash";

/**
 * Resuelve el usuario autenticado tolerando ventanas de carrera en el
 * hidratado del AuthContext: si `ctxUser` aún no llegó del React state,
 * cae a `supabase.auth.getUser()` (fuente de verdad). Sólo si ambos fallan
 * lanza "Sesión no válida".
 */
export async function resolveAuthUser(ctxUser: User | null): Promise<User> {
  if (ctxUser) return ctxUser;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sesión no válida");
  return data.user;
}

export function useAuditoriaRevisiones() {
  return useQuery({
    queryKey: AUDITORIA_REVISIONES_KEY,
    queryFn: async (): Promise<Map<string, AuditoriaRevision>> => {
      const list = await fetchAuditoriaRevisiones();
      const map = new Map<string, AuditoriaRevision>();
      for (const r of list) {
        map.set(`${r.embarque_id}|${r.regla}|${r.detalle_hash}`, r);
      }
      return map;
    },
    staleTime: 60_000,
  });
}
