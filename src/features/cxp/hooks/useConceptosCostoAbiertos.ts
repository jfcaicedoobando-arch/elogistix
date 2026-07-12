/**
 * Query hook: conceptos_costo abiertos (no liquidados) de un proveedor.
 * Usado al capturar una factura de proveedor para sugerir vínculos a embarques.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchConceptosCostoAbiertosDeProveedor, type ConceptoCostoAbierto } from "@/features/cxp/services";
import { queryKeys } from "@/lib/query";

export type { ConceptoCostoAbierto };

export function useConceptosCostoAbiertos(
  proveedorId: string | null | undefined,
  organizationId: string | null,
) {
  return useQuery({
    queryKey: queryKeys.cxp.conceptosCostoAbiertos(proveedorId, organizationId),
    queryFn: () => fetchConceptosCostoAbiertosDeProveedor(proveedorId ?? "", organizationId),
    enabled: !!proveedorId,
    staleTime: 30_000,
  });
}
