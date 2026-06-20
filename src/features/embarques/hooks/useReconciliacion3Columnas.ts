/**
 * Hook: reconciliación a 3 columnas para un embarque (Fase 2).
 */
import { useQuery } from "@tanstack/react-query";
import {
  obtenerReconciliacion3Columnas,
  type ResultadoReconciliacion3C,
} from "@/features/embarques/services/reconciliacion3Columnas";
import type { UmbralesVarianza } from "@/features/cotizacion/domain/versionadoCotizacion";

export function useReconciliacion3Columnas(
  embarqueId: string | undefined,
  umbrales?: UmbralesVarianza,
) {
  return useQuery<ResultadoReconciliacion3C>({
    queryKey: ["embarques", "reconciliacion3c", embarqueId, umbrales],
    queryFn: () => obtenerReconciliacion3Columnas(embarqueId as string, umbrales),
    enabled: Boolean(embarqueId),
    staleTime: 15_000,
  });
}
