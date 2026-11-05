import { useMutation } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { ampliarPlazo, cambiarComplejidad } from "@/features/crm/services/pricing/plazoPricing";
import { mensajeErrorPricing } from "@/features/crm/services/pricing/tiposPricing";
import { useInvalidarSolicitud } from "./useInvalidarSolicitud";

type Input =
  | { tipo: "complejidad"; id: string; oportunidadId: string | null; complejidad: string; motivo: string }
  | { tipo: "plazo"; id: string; oportunidadId: string | null; horas: number; motivo: string };

export function usePlazoPricing() {
  const invalidar = useInvalidarSolicitud();
  return useMutation({
    mutationFn: (i: Input) => i.tipo === "complejidad"
      ? cambiarComplejidad(i.id, i.complejidad, i.motivo)
      : ampliarPlazo(i.id, i.horas, i.motivo),
    onSuccess: async (_d, i) => {
      await invalidar(i.id, i.oportunidadId);
      notifySuccess(undefined, { title: i.tipo === "complejidad" ? "Complejidad actualizada" : "Plazo ampliado" });
    },
    onError: (error, variables) => notifyError(undefined, { title: "No se pudo cambiar la solicitud",
      description: mensajeErrorPricing(error), error, method: "CRM_PRICING_PLAZO", context: { variables } }),
  });
}
