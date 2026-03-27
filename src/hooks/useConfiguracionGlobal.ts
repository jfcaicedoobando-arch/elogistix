import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

export interface ConfigGlobalItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
}

export function useConfiguracionGlobal() {
  return useQuery<ConfigGlobalItem[]>({
    queryKey: queryKeys.configuracionGlobal.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracion_global")
        .select("*")
        .order("categoria")
        .order("clave");
      if (error) throw error;
      return (data ?? []) as unknown as ConfigGlobalItem[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useConfigGlobalValue<T>(categoria: string, clave: string, fallback: T): T {
  const { data } = useConfiguracionGlobal();
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  if (!item) return fallback;
  return item.valor as T;
}

export function useConfigGlobalCategoria(categoria: string): Record<string, unknown> {
  const { data } = useConfiguracionGlobal();
  if (!data) return {};
  const result: Record<string, unknown> = {};
  data.filter((c) => c.categoria === categoria).forEach((c) => {
    result[c.clave] = c.valor;
  });
  return result;
}

export function useUpdateConfiguracionGlobal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (items: { categoria: string; clave: string; valor: unknown }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from("configuracion_global")
          .update({ valor: JSON.parse(JSON.stringify(item.valor)) })
          .eq("categoria", item.categoria)
          .eq("clave", item.clave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracionGlobal.all });
      toast({ title: "Configuración global guardada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    },
  });
}
