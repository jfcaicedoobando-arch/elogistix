import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

/** Columnas necesarias para la tabla de proveedores (evita select('*')) */
const PROVEEDOR_LIST_COLUMNS = 'id, nombre, tipo, rfc, contacto, moneda_preferida' as const;

export type Proveedor = Tables<'proveedores'>;
export type ProveedorListItem = Pick<Proveedor, 'id' | 'nombre' | 'tipo' | 'rfc' | 'contacto' | 'moneda_preferida'>;

export function useProveedores() {
  const queryClient = useQueryClient();

  const { data: proveedores = [], isLoading } = useQuery({
    queryKey: queryKeys.proveedores.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedores")
        .select(PROVEEDOR_LIST_COLUMNS)
        .order("nombre");
      if (error) throw error;
      return data as ProveedorListItem[];
    },
  });

  const addProveedorMutation = useMutation({
    mutationFn: async (prov: TablesInsert<"proveedores">) => {
      const { data, error } = await supabase.from("proveedores").insert(prov).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all }),
  });

  const updateProveedorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TablesUpdate<"proveedores"> }) => {
      const { error } = await supabase.from("proveedores").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all }),
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
    queryKey: queryKeys.proveedores.detail(id!),
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
