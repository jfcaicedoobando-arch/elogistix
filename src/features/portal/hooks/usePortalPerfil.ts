import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPortalPerfil,
  actualizarContactoPortal,
} from "@/features/portal/services";
import type { PortalPerfilData } from "@/features/portal/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

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
      notifyError(undefined, { title: "No se pudo actualizar contacto", description: getErrorMessage(error), error, method: "PORTAL_UPDATE_CONTACT" });
    },
  });
}
