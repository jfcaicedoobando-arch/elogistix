/**
 * Bloque 3.3 — Notificaciones del cliente en su portal.
 * Lee la tabla `notificaciones_cliente` filtrada por RLS y expone helpers
 * para marcar leídas (una o todas).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = ["portal", "notificaciones"] as const;

export interface NotificacionCliente {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  url: string | null;
  leida_at: string | null;
  embarque_id: string | null;
  factura_id: string | null;
  created_at: string;
}

export function useNotificacionesCliente(enabled = true) {
  return useQuery({
    queryKey: KEY,
    enabled,
    queryFn: async (): Promise<NotificacionCliente[]> => {
      const { data, error } = await supabase
        .from("notificaciones_cliente")
        .select("id, tipo, titulo, mensaje, url, leida_at, embarque_id, factura_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificacionCliente[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarcarNotificacionLeida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("notificacion_cliente_marcar_leida", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarcarTodasLeidas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("notificaciones_cliente_marcar_todas_leidas");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
