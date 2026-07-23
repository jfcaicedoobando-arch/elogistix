import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared";
import {
  fetchFacturas,
  fetchGastosPendientes,
  marcarCostoPagado,
  type FacturaRow,
  type FacturaListItem,
} from "@/features/facturacion/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export type { FacturaRow, FacturaListItem };

export function useFacturas(opts: { enabled?: boolean } = {}) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturas.byOrg(organizationId),
    queryFn: () => fetchFacturas(organizationId ?? null),
    enabled: opts.enabled ?? true,
  });
}

export function useMarcarCostoPagado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: marcarCostoPagado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.facturas.gastosPendientes });
      notifySuccess(undefined, { title: "Costo marcado como pagado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al marcar costo pagado: ${error.message}`, error, method: "MARK_COST_PAID" });
    },
  });
}

export function useGastosPendientes(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.facturas.gastosPendientes,
    queryFn: fetchGastosPendientes,
    enabled: opts.enabled ?? true,
  });
}
