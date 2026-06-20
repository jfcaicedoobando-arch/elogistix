/**
 * Hook: lee los campos de decisión de tarifa de un embarque para mostrarlos en
 * sub-encabezados (TabConciliacion, etc.) sin volver a fetch del embarque entero.
 * Delega el acceso a Supabase al service `tarifaInfo.ts` (capa Services).
 */
import { useQuery } from "@tanstack/react-query";
import {
  obtenerEmbarqueTarifaInfo,
  type EmbarqueTarifaInfo,
} from "@/features/embarques/services/tarifaInfo";

export type { EmbarqueTarifaInfo } from "@/features/embarques/services/tarifaInfo";

export function useEmbarqueTarifaInfo(embarqueId: string | undefined) {
  return useQuery<EmbarqueTarifaInfo | null>({
    queryKey: ["embarques", "tarifa-info", embarqueId],
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
    queryFn: () => obtenerEmbarqueTarifaInfo(embarqueId as string),
  });
}
