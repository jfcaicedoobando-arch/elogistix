import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export interface ConfigItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
  organization_id: string;
}

/** Config para una org específica (impersonación) */
export function useConfiguracionByOrg(orgId: string | null) {
  return useQuery<ConfigItem[]>({
    queryKey: orgId ? queryKeys.configuracionOrg.byOrg(orgId) : ["noop"],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracion")
        .select("*")
        .eq("organization_id", orgId!)
        .order("categoria")
        .order("clave");
      if (error) throw error;
      return (data ?? []) as unknown as ConfigItem[];
    },
    staleTime: 60 * 1000,
  });
}

export function useUpdateConfiguracionOrg() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (items: { id: string; valor: unknown }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from("configuracion")
          .update({ valor: item.valor as Json })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracion"] });
      toast({ title: "Configuración de organización guardada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    },
  });
}
