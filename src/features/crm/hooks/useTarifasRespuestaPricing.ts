import { useQuery } from "@tanstack/react-query";
import { listarTarifasRespuesta } from "@/features/crm/services/pricing/tarifasRespuesta";

export function useTarifasRespuestaPricing(solicitudId: string) {
  return useQuery({
    queryKey: ["crm", "pricing", "tarifas-respuesta", solicitudId],
    queryFn: () => listarTarifasRespuesta(solicitudId),
  });
}
