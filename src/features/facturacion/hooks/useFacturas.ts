import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared";
import {
  fetchFacturas,
  fetchFacturasListado,
  fetchGastosPendientes,
  marcarCostoPagado,
} from "@/features/facturacion/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { invalidateSidebarAlerts } from "@/hooks/layout/useSidebarAlerts";

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
      // M13 (Ola 7): el costo aparece también en la bandeja de facturación, en
      // el expediente del embarque y en los badges del sidebar. Invalidar sólo
      // `gastosPendientes` dejaba esas pantallas mostrando el costo como
      // pendiente hasta un refresh manual.
      queryClient.invalidateQueries({ queryKey: queryKeys.facturas.gastosPendientes });
      queryClient.invalidateQueries({ queryKey: queryKeys.facturas.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.embarques.all });
      // Ola 9 · M13: el costo también alimenta CxP (gastos vinculables y
      // facturas de proveedor); sin esto la pantalla de compras se desfasa.
      queryClient.invalidateQueries({ queryKey: queryKeys.cxp.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.proveedorFacturas.all });
      // Ola 3 · P4: el concepto vive también en el expediente de costos y en
      // las bandejas de Compras; sin esto seguían mostrándolo como pendiente.
      queryClient.invalidateQueries({ queryKey: queryKeys.conceptosCosto.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.compras.all });
      invalidateSidebarAlerts(queryClient);

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

