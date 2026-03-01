import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Proveedor = Tables<'proveedores'>;

export function useProveedores() {
  const queryClient = useQueryClient();

  const { data: proveedores = [], isLoading } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const addProveedorMutation = useMutation({
    mutationFn: async (prov: TablesInsert<"proveedores">) => {
      const { error } = await supabase.from("proveedores").insert(prov);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["proveedores"] }),
  });

  const updateProveedorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TablesUpdate<"proveedores"> }) => {
      const { error } = await supabase.from("proveedores").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["proveedores"] }),
  });

  return {
    proveedores,
    isLoading,
    addProveedor: addProveedorMutation.mutateAsync,
    updateProveedor: (id: string, data: TablesUpdate<"proveedores">) =>
      updateProveedorMutation.mutateAsync({ id, data }),
    isAdding: addProveedorMutation.isPending,
    isUpdating: updateProveedorMutation.isPending,
  };
}

export function useProveedor(id: string | undefined) {
  return useQuery({
    queryKey: ["proveedores", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
