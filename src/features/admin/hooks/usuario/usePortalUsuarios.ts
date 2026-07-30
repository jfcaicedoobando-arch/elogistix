import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchUsuariosPortalCliente,
  fetchUsuariosPortalAgente,
} from "@/features/admin/services/usuario/portales";
import { deleteUserViaEdgeFunction } from "@/features/admin/services/usuario";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useUsuariosOrgScope } from "./useUsuarios";

export function useUsuariosPortalCliente(opciones?: { enabled?: boolean }) {
  const orgScope = useUsuariosOrgScope();
  return useQuery({
    queryKey: queryKeys.usuariosPortalCliente.scope(orgScope),
    queryFn: () => fetchUsuariosPortalCliente(orgScope),
    enabled: opciones?.enabled ?? true,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useUsuariosPortalAgente(opciones?: { enabled?: boolean }) {
  const orgScope = useUsuariosOrgScope();
  return useQuery({
    queryKey: queryKeys.usuariosPortalAgente.scope(orgScope),
    queryFn: () => fetchUsuariosPortalAgente(orgScope),
    enabled: opciones?.enabled ?? true,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useDeletePortalUser(tipo: "cliente" | "agente") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUserViaEdgeFunction(userId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey:
          tipo === "cliente"
            ? queryKeys.usuariosPortalCliente.all
            : queryKeys.usuariosPortalAgente.all,
      });
      notifySuccess(undefined, { title: "Usuario eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al eliminar usuario: ${error.message}`,
        error,
        method: "DELETE_PORTAL_USER",
      });
    },
  });
}
