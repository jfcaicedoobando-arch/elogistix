/**
 * Hook de detalle de proforma (vista /proformas/:id).
 * Devuelve la proforma con su factura asociada (si existe) y los conceptos_venta
 * (o los consolidados si `es_consolidada`).
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchProformaPorId,
  fetchConceptosProforma,
  fetchConceptosConsolidados,
  type ProformaDetalleFull,
  type ConceptoVentaRow,
  type ProformaConceptoConsolidadoRow,
} from "@/features/proformas/services";
import { queryKeys } from "@/lib/query";

export interface ProformaDetalleData {
  proforma: ProformaDetalleFull;
  conceptos: ConceptoVentaRow[];
  conceptosConsolidados: ProformaConceptoConsolidadoRow[];
}

export function useProformaDetalle(id: string | undefined) {
  return useQuery<ProformaDetalleData | null>({
    queryKey: queryKeys.proformas.detalle(id),
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const proforma = await fetchProformaPorId(id!);
      if (!proforma) return null;
      const esConsolidada = !!proforma.es_consolidada;
      const [conceptos, conceptosConsolidados] = await Promise.all([
        esConsolidada ? Promise.resolve([]) : fetchConceptosProforma(proforma.id),
        esConsolidada ? fetchConceptosConsolidados(proforma.id) : Promise.resolve([]),
      ]);
      return { proforma, conceptos, conceptosConsolidados };
    },
  });
}
