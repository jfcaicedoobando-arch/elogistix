/**
 * Lee los conceptos fiscales del CFDI persistidos en
 * `proveedor_facturas_conceptos` para una factura de proveedor.
 *
 * v13.307.18 — delega en el servicio `fetchConceptosCfdi` para respetar la
 * capa Hooks→Services→Lib (baseline arquitectónico).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchConceptosCfdi,
  type ConceptoCfdiRow,
} from "../services/conceptosCfdiFactura";

export type { ConceptoCfdiRow };

export function useConceptosCfdiFactura(facturaId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.cxp.conceptosCfdi(facturaId ?? null),
    queryFn: () => fetchConceptosCfdi(facturaId as string),
    enabled: !!facturaId,
    staleTime: 30_000,
  });
}
