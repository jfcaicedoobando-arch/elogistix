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
  fetchProveedoresLite,
  type ProveedorListItem,
} from "@/features/proveedor/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

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
      notifyError(undefined, { title: "No se pudo crear proveedor", description: getErrorMessage(error), error, method: "CREATE_PROVEEDOR" });
    },
  });

  const updateProveedorMutation = useMutation({
    mutationFn: ({
      id,
      data,
      expectedUpdatedAt,
      organizationId,
    }: {
      id: string;
      data: TablesUpdate<"proveedores">;
      expectedUpdatedAt?: string | null;
      organizationId?: string | null;
    }) => svcUpdate(id, data, expectedUpdatedAt, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, { title: "Proveedor actualizado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo actualizar proveedor", description: getErrorMessage(error), error, method: "UPDATE_PROVEEDOR" });
    },
  });

  const deleteProveedorMutation = useMutation({
    mutationFn: (id: string) => svcDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proveedores.all });
      notifySuccess(undefined, { title: "Proveedor eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo eliminar proveedor", description: getErrorMessage(error), error, method: "DELETE_PROVEEDOR" });
    },
  });


  return {
    addProveedor: addProveedorMutation.mutateAsync,
    updateProveedor: (
      id: string,
      data: TablesUpdate<"proveedores">,
      expectedUpdatedAt?: string | null,
      organizationId?: string | null,
    ) => updateProveedorMutation.mutateAsync({ id, data, expectedUpdatedAt, organizationId }),
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

export function useProveedoresLite() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.proveedores.lite(organizationId),
    queryFn: () => fetchProveedoresLite(organizationId),
    staleTime: 5 * 60_000,
  });
}
