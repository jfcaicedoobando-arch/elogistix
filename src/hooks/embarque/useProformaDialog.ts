/**
 * Hooks de React Query para el flujo de generación de proforma.
 * Centralizan los fetches que antes vivían imperativamente dentro del dialog.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchDiasCreditoCliente } from "@/services/clienteService";
import { fetchClienteParaPdf } from "@/services/proformaServices";

/**
 * Días de crédito por defecto del cliente (precarga del diálogo de proforma).
 * Se queda en cache mientras el dialog esté abierto y se reutiliza al reabrir.
 */
export function useDiasCreditoCliente(clienteId: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.clientes.diasCredito(clienteId ?? ""),
    enabled: !!clienteId && enabled,
    queryFn: () => fetchDiasCreditoCliente(clienteId!),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Helper imperativo (cacheado) para obtener los datos del cliente al momento de
 * generar el PDF. Usa `fetchQuery` para aprovechar el caché de React Query sin
 * necesidad de un `useQuery` permanente.
 */
export function useFetchClienteParaPdf() {
  const queryClient = useQueryClient();
  return (clienteId: string) =>
    queryClient.fetchQuery({
      queryKey: queryKeys.clientes.paraPdf(clienteId),
      queryFn: () => fetchClienteParaPdf(clienteId),
      staleTime: 5 * 60 * 1000,
    });
}
