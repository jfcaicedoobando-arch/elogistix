import { useQuery } from "@tanstack/react-query";
import { listarTarifasRespuesta } from "@/features/crm/services/pricing/tarifasRespuesta";

/**
 * Tarifas que responden una solicitud. Con `esperandoRespuesta` reconsulta
 * cada 30 s para que el solicitante vea la respuesta sin recargar.
 */
export function useTarifasRespuestaPricing(solicitudId: string, esperandoRespuesta = false) {
  return useQuery({
    queryKey: ["crm", "pricing", "tarifas-respuesta", solicitudId],
    queryFn: () => listarTarifasRespuesta(solicitudId),
    refetchInterval: esperandoRespuesta ? 30_000 : false,
  });
}
