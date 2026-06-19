import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPortalPerfil,
  actualizarContactoPortal,
  cambiarPasswordPortal,
} from "@/features/portal/services";
import type { PortalPerfilData } from "@/features/portal/services";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

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
      notifySuccess(undefined, { title: "Datos de contacto actualizados" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar contacto: ${error.message}`, error, method: "PORTAL_UPDATE_CONTACT" });
    },
  });
}

export function useCambiarPasswordPortal() {
  return useMutation({
    mutationFn: cambiarPasswordPortal,
    onSuccess: () => {
      notifySuccess(undefined, { title: "Contraseña actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al cambiar contraseña: ${error.message}`, error, method: "PORTAL_CHANGE_PASSWORD" });
    },
  });
}
