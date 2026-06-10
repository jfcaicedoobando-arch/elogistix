import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared";
import {
  fetchProveedoresPaginados,
  fetchProveedor,
  insertProveedor,
  updateProveedor as svcUpdate,
  deleteProveedor as svcDelete,
  fetchProveedorOperaciones,
  fetchProveedoresLite,
  type Proveedor,
  type ProveedorListItem,
  type ProveedorOperacion,
  type ProveedorLite,
} from "@/services/proveedor";

type TipoProveedor = Enums<"tipo_proveedor">;
type CategoriaProveedor = Enums<"categoria_proveedor">;
type SubtipoGasto = Enums<"subtipo_gasto_operativo">;

export type { Proveedor, ProveedorListItem, ProveedorOperacion, ProveedorLite };

interface UseProveedoresPaginadosParams {
  tipo?: TipoProveedor | null;
  search: string;
  page: number;
  pageSize: number;
  origen?: "Nacional" | "Extranjero" | "todos";
  categoria?: CategoriaProveedor | "todos";
  subtipoGasto?: SubtipoGasto | null;
}

export function useProveedoresPaginados({
  tipo,
  search,
  page,
  pageSize,
  origen,
  categoria,
  subtipoGasto,
}: UseProveedoresPaginadosParams) {
  const { organizationId } = useOrgFilter();
  const filters = { tipo, search, page, pageSize, organizationId, origen, categoria, subtipoGasto };

  return useQuery({
    queryKey: queryKeys.proveedores.list(filters),
    queryFn: () =>
      fetchProveedoresPaginados({ tipo, search, page, pageSize, organizationId, origen, categoria, subtipoGasto }),
    placeholderData: (prev) => prev,
  });
}

export function useProveedorMutations() {
  const queryClient = useQueryClient();

  const addProveedorMutation = useMutation({
    mutationFn: (prov: TablesInsert<"proveedores">) => insertProveedor(prov),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all }),
  });

  const updateProveedorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<"proveedores"> }) =>
      svcUpdate(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all }),
  });

  const deleteProveedorMutation = useMutation({
    mutationFn: (id: string) => svcDelete(id),
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
    queryFn: () => fetchProveedor(id!),
  });
}

export function useProveedorOperaciones(proveedorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proveedores.operaciones(proveedorId!),
    enabled: !!proveedorId,
    queryFn: () => fetchProveedorOperaciones(proveedorId!),
  });
}

export function useProveedoresLite() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.proveedores.lite(organizationId),
    queryFn: () => fetchProveedoresLite(organizationId),
    staleTime: 5 * 60_000,
  });
}
