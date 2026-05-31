import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificacionInterna =
  Database["public"]["Tables"]["notificaciones_internas"]["Row"];

const QUERY_KEY = ["notificaciones-internas"] as const;
const MAX_RECIENTES = 50;

export function useNotificacionesInternas() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<NotificacionInterna[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notificaciones_internas")
        .select("*")
        .eq("usuario_id", userId)
        .order("created_at", { ascending: false })
        .range(0, MAX_RECIENTES - 1);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Realtime: refrescar al recibir cambios
  useEffect(() => {
    let cancelled = false;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;

      const channel = supabase
        .channel(`notif-internas-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notificaciones_internas",
            filter: `usuario_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: QUERY_KEY });
          }
        )
        .subscribe();
      channelRef = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [qc]);

  const marcarLeida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificaciones_internas")
        .update({ leida: true, leida_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const marcarTodasLeidas = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return;
      const { error } = await supabase
        .from("notificaciones_internas")
        .update({ leida: true, leida_at: new Date().toISOString() })
        .eq("usuario_id", userId)
        .eq("leida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const noLeidas = (query.data ?? []).filter((n) => !n.leida).length;

  return {
    notificaciones: query.data ?? [],
    isLoading: query.isLoading,
    noLeidas,
    marcarLeida: marcarLeida.mutate,
    marcarTodasLeidas: marcarTodasLeidas.mutate,
  };
}
