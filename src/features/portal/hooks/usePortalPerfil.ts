import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPortalPerfil,
  actualizarContactoPortal,
  cambiarPasswordPortal,
} from "@/features/portal/services";
import type { PortalPerfilData } from "@/features/portal/services";

export type { PortalPerfilData };

export function usePortalPerfil() {
  return useQuery<PortalPerfilData, Error>({
    queryKey: queryKeys.portal.perfil,
    queryFn: fetchPortalPerfil,
  });
}

export function useActualizarContactoPortal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarContactoPortal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.portal.perfil });
    },
  });
}

export function useCambiarPasswordPortal() {
  return useMutation({
    mutationFn: cambiarPasswordPortal,
  });
}
