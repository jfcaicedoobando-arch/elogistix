import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/useOrgFilter";
import {
  fetchFacturas,
  fetchGastosPendientes,
  marcarCostoPagado,
  type FacturaRow,
  type FacturaListItem,
} from "@/services/facturas";

export type { FacturaRow, FacturaListItem };

export function useFacturas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: [...queryKeys.facturas.all, organizationId],
    queryFn: () => fetchFacturas(organizationId ?? null),
  });
}

export function useMarcarCostoPagado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marcarCostoPagado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.facturas.gastosPendientes });
    },
  });
}

export function useGastosPendientes() {
  return useQuery({
    queryKey: queryKeys.facturas.gastosPendientes,
    queryFn: fetchGastosPendientes,
  });
}
