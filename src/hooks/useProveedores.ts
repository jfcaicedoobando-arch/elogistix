import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import type { Enums } from "@/integrations/supabase/types";
type TipoProveedor = Enums<'tipo_proveedor'>;

/** Columnas necesarias para la tabla de proveedores */
const PROVEEDOR_LIST_COLUMNS = 'id, nombre, tipo, rfc, contacto, moneda_preferida' as const;

export type Proveedor = Tables<'proveedores'>;
export type ProveedorListItem = Pick<Proveedor, 'id' | 'nombre' | 'tipo' | 'rfc' | 'contacto' | 'moneda_preferida'>;

// --- Hook paginado server-side para la vista de lista ---

interface UseProveedoresPaginadosParams {
  tipo: TipoProveedor;
  search: string;
  page: number;
  pageSize: number;
}

export function useProveedoresPaginados({ tipo, search, page, pageSize }: UseProveedoresPaginadosParams) {
  const filters = { tipo, search, page, pageSize };

  return useQuery({
    queryKey: queryKeys.proveedores.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('proveedores')
        .select(PROVEEDOR_LIST_COLUMNS, { count: 'exact' })
        .eq('tipo', tipo)
        .order('nombre');

      if (search) {
        query = query.ilike('nombre', `%${search}%`);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as ProveedorListItem[], count: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}

// --- Hook de mutaciones para Proveedores (sin query de lista) ---

export function useProveedorMutations() {
  const queryClient = useQueryClient();

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

  const deleteProveedorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proveedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all }),
  });

  return {
    addProveedor: addProveedorMutation.mutateAsync,
    updateProveedor: (id: string, data: TablesUpdate<"proveedores">) =>
      updateProveedorMutation.mutateAsync({ id, data }),
    deleteProveedor: deleteProveedorMutation.mutateAsync,
    isAdding: addProveedorMutation.isPending,
    isUpdating: updateProveedorMutation.isPending,
    isDeleting: deleteProveedorMutation.isPending,
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

/** Operaciones (conceptos de costo) vinculadas a un proveedor */
export interface ProveedorOperacion {
  concepto: string;
  monto: number;
  moneda: string;
  estadoLiquidacion: string;
  fechaVencimiento: string | null;
  expediente: string;
  embarqueId: string;
  clienteNombre: string;
}

export function useProveedorOperaciones(proveedorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proveedores.operaciones(proveedorId!),
    enabled: !!proveedorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conceptos_costo")
        .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente, id, cliente_nombre)")
        .eq("proveedor_id", proveedorId!);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const embarque = row.embarques as unknown as { expediente: string; id: string; cliente_nombre: string } | null;
        return {
          concepto: row.concepto,
          monto: Number(row.monto),
          moneda: row.moneda,
          estadoLiquidacion: row.estado_liquidacion,
          fechaVencimiento: row.fecha_vencimiento,
          expediente: embarque?.expediente ?? '',
          embarqueId: embarque?.id ?? '',
          clienteNombre: embarque?.cliente_nombre ?? '',
        } satisfies ProveedorOperacion;
      });
    },
  });
}
