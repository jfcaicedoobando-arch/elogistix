/**
 * Hook para el selector de usuarios disponibles en el diálogo de "Nueva organización".
 */
import { useQuery } from "@tanstack/react-query";
import { fetchAvailableUsersSinMembresia } from "@/features/admin/services/usuario/availableUsers";
import { admin as adminKeys } from "@/features/admin/queryKeys";

export function useNuevaOrganizacionUsuarios(open: boolean) {
  return useQuery({
    queryKey: adminKeys.allUsersOptions,
    // Ola 4 · N27: excluir usuarios que ya pertenecen a una organización.
    queryFn: fetchAvailableUsersSinMembresia,
    enabled: open,
    staleTime: 60_000,
  });
}
