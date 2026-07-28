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
  type ProveedorListItem,
} from "@/features/proveedor/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

type TipoProveedor = Enums<"tipo_proveedor">;

export type {  ProveedorListItem,   };

interface UseProveedoresPaginadosParams {
  tipo?: TipoProveedor | null;
  search: string;
  page: number;
  pageSize: number;
  origen?: "Nacional" | "Extranjero" | "todos";
}

export function useProveedoresPaginados({
  tipo,
  search,
  page,
  pageSize,
  origen,
}: UseProveedoresPaginadosParams) {
  const { organizationId } = useOrgFilter();
  const filters = { tipo, search, page, pageSize, organizationId, origen };

  return useQuery({
    queryKey: queryKeys.proveedores.list(filters),
    queryFn: () =>
      fetchProveedoresPaginados({ tipo, search, page, pageSize, organizationId, origen }),
    placeholderData: (prev) => prev,
  });
}

export function useProveedorMutations() {
  const queryClient = useQueryClient();

  const addProveedorMutation = useMutation({
    mutationFn: (prov: TablesInsert<"proveedores">) => insertProveedor(prov),
    onSuccess: () => {
      // Toast de éxito lo emite cada call site (useProveedoresCrear /
      // CrearProveedorDesdeCfdiDialog) para evitar avisos duplicados.
      queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear proveedor: ${error.message}`, error, method: "CREATE_PROVEEDOR" });
    },
  });

  const updateProveedorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<"proveedores"> }) =>
      svcUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, { title: "Proveedor actualizado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar proveedor: ${error.message}`, error, method: "UPDATE_PROVEEDOR" });
    },
  });

  const deleteProveedorMutation = useMutation({
    mutationFn: (id: string) => svcDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, { title: "Proveedor eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar proveedor: ${error.message}`, error, method: "DELETE_PROVEEDOR" });
    },
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
