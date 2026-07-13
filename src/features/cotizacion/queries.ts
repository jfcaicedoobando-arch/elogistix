/**
 * Query options centralizados para el dominio **cotizaciones**.
 *
 * Piloto de la Fase 2 del roadmap TanStack: encapsula `queryKey` + `queryFn`
 * + defaults (`staleTime`, `retry`) en factories reutilizables con
 * `useQuery`, `prefetchQuery`, `ensureQueryData` y `useSuspenseQuery`.
 *
 * Regla: los hooks de este módulo **no** deben volver a declarar staleTime
 * o queryFn — todo pasa por estos factories.
 */
import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { staleTimes } from "@/lib/query/staleTimes";
import type { CotizacionRow } from "@/features/cotizacion/types";
import {
  fetchCotizaciones,
  fetchCotizacionesAceptadas,
  fetchCotizacionById,
  fetchEmbarquesVinculados,
  fetchCotizacionFolio,
} from "@/features/cotizacion/services";

export const cotizacionQueries = {
  /** Lista completa de cotizaciones filtrada por org. */
  list: (organizationId?: string | null) =>
    queryOptions({
      queryKey: queryKeys.cotizaciones.byOrg(organizationId),
      queryFn: () => fetchCotizaciones(organizationId ?? null),
      staleTime: staleTimes.MEDIUM,
    }),

  /** Cotizaciones aceptadas (subset para selects/vinculación). */
  aceptadas: (organizationId?: string | null) =>
    queryOptions({
      queryKey: queryKeys.cotizaciones.aceptadas(organizationId),
      queryFn: () => fetchCotizacionesAceptadas(organizationId ?? null),
      staleTime: staleTimes.MEDIUM,
    }),

  /** Detalle de una cotización por id. */
  detail: (id: string) =>
    queryOptions<CotizacionRow | null>({
      queryKey: queryKeys.cotizaciones.detail(id),
      queryFn: () => fetchCotizacionById(id),
      staleTime: staleTimes.SHORT,
    }),

  /** Embarques vinculados a una cotización. */
  embarquesVinculados: (cotizacionId: string) =>
    queryOptions({
      queryKey: queryKeys.cotizaciones.embarquesVinculados(cotizacionId),
      queryFn: () => fetchEmbarquesVinculados(cotizacionId),
      staleTime: staleTimes.SHORT,
    }),

  /** Folio (chip/link). Cambia poco → LONG. */
  folio: (cotizacionId: string) =>
    queryOptions<string | null>({
      queryKey: queryKeys.cotizaciones.folio(cotizacionId),
      queryFn: () => fetchCotizacionFolio(cotizacionId),
      staleTime: staleTimes.LONG,
    }),
} as const;
