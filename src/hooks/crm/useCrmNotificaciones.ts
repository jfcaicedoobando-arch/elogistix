/**
 * Notificaciones in-app del CRM.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CrmNotificacionRow {
  id: string;
  user_id: string;
  organization_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  link: string | null;
  leida_at: string | null;
  created_at: string;
}

const COLS = "id, user_id, organization_id, tipo, titulo, mensaje, link, leida_at, created_at";

export function useCrmNotificaciones(limit = 20) {
  const { user } = useAuth();
  return useQuery<CrmNotificacionRow[]>({
    queryKey: ["crm", "notificaciones", user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_notificaciones")
        .select(COLS)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as CrmNotificacionRow[];
    },
    staleTime: 30_000,
  });
}

export function useCrmNotificacionesNoLeidasCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["crm", "notificaciones", "unread-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("crm_notificaciones")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("leida_at", null);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
}

export function useMarcarNotificacionesLeidas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      let q = supabase
        .from("crm_notificaciones")
        .update({ leida_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .is("leida_at", null);
      if (ids && ids.length > 0) q = q.in("id", ids);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "notificaciones"] });
    },
  });
}

export interface CrearNotificacionInput {
  user_id: string;
  tipo: string;
  titulo: string;
  mensaje?: string;
  link?: string | null;
}

/** Inserta una notificación. Falla silenciosamente — nunca debe romper la acción principal. */
export async function crearNotificacionSilencioso(input: CrearNotificacionInput): Promise<void> {
  try {
    await supabase.from("crm_notificaciones").insert({
      user_id: input.user_id,
      tipo: input.tipo,
      titulo: input.titulo,
      mensaje: input.mensaje ?? "",
      link: input.link ?? null,
    });
  } catch (e) {
    console.warn("[crm_notificaciones] insert falló:", e);
  }
}
