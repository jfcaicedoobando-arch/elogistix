import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface AlertaSistema {
  id: string;
  severity: string;
  source: string;
  message: string;
  payload: Record<string, unknown> | null;
  dedupe_key: string | null;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

const QK_PENDING = ["alertas-sistema", "pending-count"] as const;
const QK_LIST = ["alertas-sistema", "list"] as const;

/** Conteo de alertas no reconocidas. Solo significativo para super_admin. */
export function useAlertasPendingCount() {
  const { role } = useAuth();
  const enabled = role === "super_admin";

  const { data } = useQuery({
    queryKey: QK_PENDING,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("alertas_sistema_pending_count");
      if (error) throw error;
      return Number(data ?? 0);
    },
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return { count: enabled ? data ?? 0 : 0 };
}

/** Listado completo de alertas (últimos 200 registros). */
export function useAlertasSistemaList(includeAcknowledged = false) {
  const { role } = useAuth();
  const enabled = role === "super_admin";

  return useQuery({
    queryKey: [...QK_LIST, includeAcknowledged],
    queryFn: async (): Promise<AlertaSistema[]> => {
      let query = supabase
        .from("alertas_sistema")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!includeAcknowledged) query = query.is("acknowledged_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AlertaSistema[];
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Marca una alerta como reconocida. */
export function useAcknowledgeAlerta() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alertas_sistema")
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK_PENDING });
      qc.invalidateQueries({ queryKey: QK_LIST });
    },
    onError: (err: Error) => {
      toast({ title: "No se pudo reconocer la alerta", description: err.message, variant: "destructive" });
    },
  });
}
