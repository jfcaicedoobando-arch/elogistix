import { useQuery } from "@tanstack/react-query";
import {
  fetchHistorialFactura,
  type EventoHistorialFactura,
} from "@/features/cxp/services/historialFactura";
import { queryKeys } from "@/lib/query";

export type { EventoHistorialFactura };

export function useHistorialFactura(facturaId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cxp.historial(facturaId),
    queryFn: () => fetchHistorialFactura(facturaId as string),
    enabled: !!facturaId && enabled,
    staleTime: 30_000,
    // Evita parpadeo a "Sin eventos" al cerrar/abrir el collapsible:
    // mantiene los datos previos visibles mientras refetchea en background.
    placeholderData: (prev) => prev,
  });
}
