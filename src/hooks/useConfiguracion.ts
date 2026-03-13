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
}

export function useConfiguracion() {
  return useQuery<ConfigItem[]>({
    queryKey: queryKeys.configuracion.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracion")
        .select("*")
        .order("categoria")
        .order("clave");
      if (error) throw error;
      return (data ?? []) as unknown as ConfigItem[];
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

/** Get a single config value with a fallback */
export function useConfigValue<T>(categoria: string, clave: string, fallback: T): T {
  const { data } = useConfiguracion();
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  if (!item) return fallback;
  return item.valor as T;
}

/** Get all config items for a category */
export function useConfigCategoria(categoria: string): Record<string, unknown> {
  const { data } = useConfiguracion();
  if (!data) return {};
  const result: Record<string, unknown> = {};
  data.filter((c) => c.categoria === categoria).forEach((c) => {
    result[c.clave] = c.valor;
  });
  return result;
}

export function useUpdateConfiguracion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (items: { categoria: string; clave: string; valor: unknown }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from("configuracion")
          .update({ valor: item.valor as Json })
          .eq("categoria", item.categoria)
          .eq("clave", item.clave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracion.all });
      toast({ title: "Configuración guardada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    },
  });
}
