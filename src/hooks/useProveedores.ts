import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Proveedor } from "@/data/types";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

function rowToProveedor(row: any): Proveedor {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    pais: row.pais ?? undefined,
    rfc: row.rfc,
    contacto: row.contacto,
    email: row.email,
    telefono: row.telefono,
    monedaPreferida: row.moneda_preferida,
    origenProveedor: row.origen_proveedor ?? undefined,
  };
}

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
      return (data ?? []).map(rowToProveedor);
    },
  });

  const addProveedorMutation = useMutation({
    mutationFn: async (prov: Omit<Proveedor, "id">) => {
      const insert: TablesInsert<"proveedores"> = {
        nombre: prov.nombre,
        tipo: prov.tipo,
        pais: prov.pais ?? null,
        rfc: prov.rfc,
        contacto: prov.contacto,
        email: prov.email,
        telefono: prov.telefono,
        moneda_preferida: prov.monedaPreferida,
        origen_proveedor: prov.origenProveedor ?? null,
      };
      const { error } = await supabase.from("proveedores").insert(insert);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["proveedores"] }),
  });

  const updateProveedorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Proveedor> }) => {
      const update: TablesUpdate<"proveedores"> = {};
      if (data.nombre !== undefined) update.nombre = data.nombre;
      if (data.tipo !== undefined) update.tipo = data.tipo;
      if (data.pais !== undefined) update.pais = data.pais ?? null;
      if (data.rfc !== undefined) update.rfc = data.rfc;
      if (data.contacto !== undefined) update.contacto = data.contacto;
      if (data.email !== undefined) update.email = data.email;
      if (data.telefono !== undefined) update.telefono = data.telefono;
      if (data.monedaPreferida !== undefined) update.moneda_preferida = data.monedaPreferida;
      if (data.origenProveedor !== undefined) update.origen_proveedor = data.origenProveedor ?? null;
      const { error } = await supabase.from("proveedores").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["proveedores"] }),
  });

  return {
    proveedores,
    isLoading,
    addProveedor: addProveedorMutation.mutateAsync,
    updateProveedor: (id: string, data: Partial<Proveedor>) =>
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
      if (!data) return null;
      return rowToProveedor(data);
    },
  });
}
