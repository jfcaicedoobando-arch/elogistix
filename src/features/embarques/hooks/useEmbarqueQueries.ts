import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrgFilter } from '@/hooks/shared/useOrgFilter';
import { queryKeys } from '@/lib/query';
import { embarqueQueries } from '@/features/embarques/queries';
import type { EmbarquesPaginadosFilters } from '@/features/embarques/services';
import { EMBARQUE_ID_UUID, fetchEmbarqueIdPorExpediente } from '@/features/embarques/services/queries/detalle';


interface UseEmbarquesPaginadosParams {
  enabled?: boolean;
  search: string;
  filterModo: string;
  filterEstado: string;
  filterCliente: string;
  filterOperador: string;
  filterProforma?: string;
  page: number;
  pageSize: number;
  fechaDesde?: string;
  fechaHasta?: string;
  sortBy?: import('@/features/embarques/services/queries').SortableEmbarqueColumn;
  sortDir?: 'asc' | 'desc';
}

export function useEmbarquesPaginados({
  enabled = true, search, filterModo, filterEstado, filterCliente, filterOperador, filterProforma = 'todos', page, pageSize, fechaDesde, fechaHasta, sortBy, sortDir,
}: UseEmbarquesPaginadosParams) {
  const { organizationId } = useOrgFilter();
  const filters: EmbarquesPaginadosFilters & { filterEstado: string } = {
    organizationId,
    search,
    filterModo,
    filterCliente,
    filterOperador,
    filterProforma,
    fechaDesde,
    fechaHasta,
    page,
    pageSize,
    sortBy,
    sortDir,
    filterEstado,
  };

  return useQuery({
    ...embarqueQueries.list(filters),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useEmbarque(id: string | undefined) {
  return useQuery({
    ...embarqueQueries.detail(id ?? ''),
    enabled: !!id,
  });
}

export function useEmbarqueResumen(idOrExpediente: string | undefined) {
  const { organizationId, orgListo } = useOrgFilter();
  const expediente = idOrExpediente && !EMBARQUE_ID_UUID.test(idOrExpediente) ? idOrExpediente : "";
  const lookup = useQuery({
    queryKey: queryKeys.embarques.detallePorExpediente(expediente, organizationId),
    queryFn: () => fetchEmbarqueIdPorExpediente(expediente),
    enabled: orgListo && !!expediente,
    staleTime: 30_000,
  });
  const id = expediente ? lookup.data ?? undefined : idOrExpediente;
  const detalle = useEmbarque(orgListo ? id : undefined);
  return {
    embarque: detalle.data ?? null,
    isLoading: !orgListo || lookup.isLoading || detalle.isLoading,
    error: lookup.error ?? detalle.error,
    refetch: lookup.error ? lookup.refetch : detalle.refetch,
  };
}

/** Hook para prefetch en hover (lista → detalle) */
export function usePrefetchEmbarque() {
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((id: string) => {
    clearTimeout(timer.current);
    // Una pasada rápida sobre las filas sólo anticipa el resumen de la última.
    timer.current = setTimeout(() => {
      void queryClient.prefetchQuery(embarqueQueries.detail(id));
    }, 200);
  }, [queryClient]);
}

export function useEmbarqueConceptosVenta(embarqueId: string | undefined) {
  return useQuery({
    ...embarqueQueries.conceptosVenta(embarqueId ?? ''),
    enabled: !!embarqueId,
  });
}

export function useEmbarqueConceptosCosto(embarqueId: string | undefined) {
  return useQuery({
    ...embarqueQueries.conceptosCosto(embarqueId ?? ''),
    enabled: !!embarqueId,
  });
}


export type { ExpedienteCliente } from '@/features/embarques/services';

export function useExpedientesCliente(clienteId: string | undefined) {
  const { organizationId } = useOrgFilter();
  return useQuery({
    ...embarqueQueries.expedientesCliente(clienteId ?? '', organizationId),
    enabled: !!clienteId,
  });
}

/** Proveedores presentes en los costos del embarque (buzón CxP). */
export function useProveedoresDelEmbarque(embarqueId: string | undefined) {
  return useQuery({
    ...embarqueQueries.proveedoresDelEmbarque(embarqueId ?? ''),
    enabled: !!embarqueId,
  });
}

/**
 * v13.503.0 — Costos vivos del proveedor en el embarque (cotejo del monto
 * facturado contra lo costeado al subir un documento al buzón CxP).
 */
export function useCostosProveedorEmbarque(
  embarqueId: string | undefined,
  proveedorId: string | null | undefined,
) {
  return useQuery({
    ...embarqueQueries.costosProveedor(embarqueId ?? '', proveedorId ?? ''),
    enabled: !!embarqueId && !!proveedorId,
  });
}

/**
 * v13.506.0 — Conceptos de costo pendientes del proveedor en el embarque, para
 * que el operador marque cuáles cubre el documento que sube al buzón.
 */
export function useConceptosProveedorEmbarque(
  embarqueId: string | undefined,
  proveedorId: string | null | undefined,
) {
  return useQuery({
    ...embarqueQueries.conceptosProveedorEmbarque(embarqueId ?? '', proveedorId ?? ''),
    enabled: !!embarqueId && !!proveedorId,
  });
}

export function useProveedoresForSelect() {
  const { organizationId } = useOrgFilter();
  return useQuery(embarqueQueries.proveedoresSelect(organizationId));
}
