/**
 * Consistencia fiscal del caso de refacturación (original vs. nueva vs. depósito).
 */
import { useQuery } from "@tanstack/react-query";
import {
  validarConsistenciaRefacturacion,
  type ConsistenciaRefacturacion,
} from "@/features/facturacion/services/refacturacionConsistencia";

export function useRefacturacionConsistencia(
  casoId: string | null,
  enabled: boolean,
) {
  return useQuery<ConsistenciaRefacturacion>({
    queryKey: ["refacturacion", "consistencia", casoId],
    enabled: enabled && !!casoId,
    queryFn: () => validarConsistenciaRefacturacion(casoId as string),
    staleTime: 15_000,
  });
}
