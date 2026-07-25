/**
 * Cuenta de facturas de proveedor por pagar (aprobadas con saldo > 0) en la
 * org del usuario. Usado para el badge del sidebar en Compras → Por pagar.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPorPagarCount } from "@/features/cxp/services/cxpPorPagarCount";
import { queryKeys } from "@/lib/query";

export function useCxpPorPagarCount() {
  return useQuery({
    queryKey: queryKeys.cxp.porPagarCount,
    queryFn: fetchPorPagarCount,
    staleTime: 60_000,
  });
}
