/**
 * Hooks para sugerencias y búsqueda manual de embarques al capturar una
 * factura de proveedor.
 */
import { useQuery } from "@tanstack/react-query";
import {
  sugerirEmbarquesParaProveedor,
  buscarEmbarquesPorTexto,
  type EmbarqueSugerido,
} from "@/features/cxp/services/sugerirEmbarques";
import { queryKeys } from "@/lib/query";

export type { EmbarqueSugerido };

export function useSugerirEmbarquesProveedor(
  proveedorId: string | null | undefined,
  organizationId: string | null,
) {
  return useQuery({
    queryKey: queryKeys.cxp.sugerirEmbarques(proveedorId, organizationId),
    queryFn: () => sugerirEmbarquesParaProveedor(proveedorId ?? "", organizationId, 10),
    enabled: !!proveedorId && !!organizationId,
    staleTime: 30_000,
  });
}

export function useBuscarEmbarquesPorTexto(
  term: string,
  organizationId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.cxp.buscarEmbarques(term, organizationId),
    queryFn: () => buscarEmbarquesPorTexto(term, organizationId, 8),
    enabled: enabled && term.trim().length >= 2 && !!organizationId,
    staleTime: 10_000,
  });
}
