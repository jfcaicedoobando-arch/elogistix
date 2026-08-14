/**
 * Vista previa del resultado de la etapa activa del asistente de refacturación.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  simularPasoRefacturacion,
  type SimulacionPaso,
} from "@/features/facturacion/services/refacturacionSimulacion";

export function useRefacturacionSimulacion(
  casoId: string | null,
  paso: number,
  enabled: boolean,
) {
  return useQuery<SimulacionPaso>({
    queryKey: queryKeys.facturacion.refacturacionSimulacion(casoId, paso),
    enabled: enabled && !!casoId,
    queryFn: () => simularPasoRefacturacion(casoId as string, paso),
    staleTime: 10_000,
  });
}
