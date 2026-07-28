import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared";
import {
  fetchFacturas,
  fetchFacturasListado,
  fetchGastosPendientes,
  marcarCostoPagado,
  type FacturaRow,
  type FacturaListItem,
} from "@/features/facturacion/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

;

export function useFacturas(opts: { enabled?: boolean } = {}) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturas.byOrg(organizationId),
    queryFn: () => fetchFacturas(organizationId ?? null),
    enabled: opts.enabled ?? true,
  });
}

/**
 * P7 (v13.317.3) — Paginación server-side de la bandeja de Facturación.
 * Trae ≤`pageSize` filas por página vía RPC `facturas_listado`, con `count`
 * total para calcular `totalPages` sin descargar todo.
 */
export function useFacturasListado(opts: {
  page: number;
  pageSize: number;
  search?: string;
  estado?: string;
  enabled?: boolean;
}) {
  const { organizationId } = useOrgFilter();
  const filtros = {
    organizationId,
    search: opts.search ?? "",
    estado: opts.estado ?? "todos",
    page: opts.page,
    pageSize: opts.pageSize,
  };
  return useQuery({
    queryKey: queryKeys.facturas.listado(filtros),
    queryFn: () =>
      fetchFacturasListado({
        organizationId: organizationId ?? null,
        search: opts.search,
        estado: opts.estado,
        page: opts.page,
        pageSize: opts.pageSize,
      }),
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData,
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

