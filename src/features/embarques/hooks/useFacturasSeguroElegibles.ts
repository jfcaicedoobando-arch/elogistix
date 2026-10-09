import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchFacturasSeguroElegibles, type FacturasSeguroCursor, type MonedaSeguro } from "@/features/embarques/services/seguros";
import { normalizarPrimaSeguro, SEGURO_FACTURA_SELECTOR_ENABLED, SEGURO_FACTURA_SELECTOR_VERSION } from "../domain/seguroFacturaSelector";
import { queryKeys } from "@/lib/query";
import { useEmbarquePrivateScope } from "./useEmbarquePrivateScope";

export interface FacturasSeguroContext {
  embarqueId: string;
  prima: number | string;
  moneda: MonedaSeguro;
  seguroId: string | null;
  tipoCambioUsd: number | null;
  tipoCambioEur: number | null;
  open: boolean;
}

export function useFacturasSeguroElegibles(context: FacturasSeguroContext) {
  // effectiveRole isolates cache entries; it is not an entitlement check.
  // The server enforces the positive approved audience and all current row gates.
  const scope = useEmbarquePrivateScope();
  const prima = normalizarPrimaSeguro(context.prima);
  const available = SEGURO_FACTURA_SELECTOR_ENABLED && scope.ready && prima !== null && Boolean(context.embarqueId);
  const query = useInfiniteQuery({
    queryKey: queryKeys.embarques.segurosFacturasElegibles(context.embarqueId, [
      ...scope.key, prima, context.moneda, context.seguroId,
      context.tipoCambioUsd, context.tipoCambioEur, SEGURO_FACTURA_SELECTOR_VERSION, context.open, scope.ready,
    ]),
    queryFn: ({ pageParam, signal }) => fetchFacturasSeguroElegibles({
      embarqueId: context.embarqueId,
      prima: prima ?? "", moneda: context.moneda, seguroId: context.seguroId, cursor: pageParam,
    }, signal),
    initialPageParam: null as FacturasSeguroCursor | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: available && context.open,
    // These private pages are never reused as placeholders after a context switch.
    // Consuming AbortSignal cancels old requests on key change or dismissal.
    gcTime: 0,
    staleTime: 0,
    placeholderData: undefined,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: false,
  });
  const hidePages = !available || !context.open || query.isRefetching || query.isRefetchError;
  // Pages are separate snapshots. An edited issue date may move a previously
  // returned invoice below the next cursor. Keep one option per ID, with its
  // latest observed header, without modifying server cursors or reservations.
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()];
  return {
    ...query,
    data: hidePages ? undefined : query.data,
    items: hidePages ? [] : uniqueItems,
    unavailable: !available,
    complete: available && context.open && query.isSuccess && !query.hasNextPage && !query.isFetching,
  };
}
