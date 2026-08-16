/**
 * Mutación para autorizar el margen esperado de una oportunidad.
 * La segregación de funciones (SoD) la impone la RPC en base de datos.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { autorizarMargenOportunidad } from "@/features/crm/services";

export function useAutorizarMargen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: autorizarMargenOportunidad,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({
        queryKey: queryKeys.crm.oportunidades.detail(vars.oportunidadId),
      });
      notifySuccess(undefined, { title: "Margen autorizado" });
    },
    onError: (error: Error) => {
      const msg = getErrorMessage(error);
      notifyError(undefined, {
        title: msg.includes("LC_SIN_PERMISO_AUTORIZAR_MARGEN")
          ? "No tienes permiso para autorizar el margen"
          : "No se pudo autorizar el margen",
        description: msg.includes("LC_SIN_PERMISO_AUTORIZAR_MARGEN")
          ? "Sólo gerencia comercial o administración pueden autorizarlo."
          : msg,
        error,
        method: "AUTORIZAR_MARGEN",
      });
    },
  });
}
