/**
 * Query options centralizados para el dominio **embarques**.
 *
 * Piloto de la Fase 2 del roadmap TanStack: encapsula `queryKey` + `queryFn`
 * + defaults (`staleTime`) en factories reutilizables con `useQuery`,
 * `prefetchQuery`, `ensureQueryData` y `useSuspenseQuery`.
 */
import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { staleTimes } from "@/lib/query/staleTimes";
import {
  fetchEmbarquesPaginados,
  fetchEmbarqueById,
  fetchEmbarqueConceptosVenta,
  fetchEmbarqueConceptosCosto,
  fetchExpedientesCliente,
  fetchProveedoresForSelect,
  fetchProveedoresDelEmbarque,
  type EmbarquesPaginadosFilters,
} from "@/features/embarques/services";

export const embarqueQueries = {
  /** Listado paginado + filtros. `placeholderData` se aplica en el hook. */
  list: (filters: EmbarquesPaginadosFilters) =>
    queryOptions({
      // SAFE-CAST: la factory acepta un DTO plano; sólo se usa como parte del queryKey.
      queryKey: queryKeys.embarques.list(filters as unknown as Record<string, unknown>),
      queryFn: () => fetchEmbarquesPaginados(filters),
      staleTime: staleTimes.MEDIUM,
    }),

  /** Detalle de embarque. */
  detail: (id: string) =>
    queryOptions({
      queryKey: queryKeys.embarques.detail(id),
      queryFn: () => fetchEmbarqueById(id),
      staleTime: staleTimes.SHORT,
    }),

  /** Conceptos de venta del embarque. */
  conceptosVenta: (embarqueId: string) =>
    queryOptions({
      queryKey: queryKeys.embarques.conceptosVenta(embarqueId),
      queryFn: () => fetchEmbarqueConceptosVenta(embarqueId),
      staleTime: staleTimes.SHORT,
    }),

  /** Conceptos de costo del embarque. */
  conceptosCosto: (embarqueId: string) =>
    queryOptions({
      queryKey: queryKeys.embarques.conceptosCosto(embarqueId),
      queryFn: () => fetchEmbarqueConceptosCosto(embarqueId),
      staleTime: staleTimes.SHORT,
    }),

  /** Expedientes previos de un cliente (para selects en wizard). */
  expedientesCliente: (clienteId: string, organizationId?: string | null) =>
    queryOptions({
      queryKey: queryKeys.embarques.expedientesCliente(clienteId, organizationId),
      queryFn: () => fetchExpedientesCliente(clienteId),
      staleTime: staleTimes.MEDIUM,
    }),

  /** Proveedores para selects. Cambia poco. */
  proveedoresSelect: (organizationId?: string | null) =>
    queryOptions({
      queryKey: queryKeys.proveedores.selectByOrg(organizationId),
      queryFn: () => fetchProveedoresForSelect(organizationId ?? null),
      staleTime: staleTimes.LONG,
    }),

  /** Proveedores que ya aparecen en los costos del embarque. */
  proveedoresDelEmbarque: (embarqueId: string) =>
    queryOptions({
      queryKey: queryKeys.embarques.proveedoresDelEmbarque(embarqueId),
      queryFn: () => fetchProveedoresDelEmbarque(embarqueId),
      staleTime: staleTimes.SHORT,
    }),
} as const;
