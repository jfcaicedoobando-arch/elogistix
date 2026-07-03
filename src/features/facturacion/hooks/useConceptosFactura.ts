/**
 * useConceptosFactura — lista de conceptos actuales de una factura.
 * Reactiva a mutaciones en `conceptos_factura` invalidando la key.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchConceptosFactura, type ConceptoFacturaRow } from "@/features/facturacion/services/conceptosFacturaCrud";

export const conceptosFacturaKey = (facturaId: string | undefined) =>
  ["conceptos_factura", facturaId] as const;

export function useConceptosFactura(facturaId: string | undefined) {
  return useQuery<ConceptoFacturaRow[]>({
    queryKey: conceptosFacturaKey(facturaId),
    enabled: !!facturaId,
    queryFn: () => fetchConceptosFactura(facturaId!),
  });
}
