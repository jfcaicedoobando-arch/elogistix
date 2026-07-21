/**
 * Hook para consultar la exposición de crédito consolidada del cliente
 * (días, límite MXN, saldo pendiente, disponible, excedido).
 * Fuente única: RPC `get_exposicion_credito_cliente`.
 */
import { useQuery } from "@tanstack/react-query";
import { clientes as clientesKeys } from "@/features/cliente/queryKeys";
import { fetchExposicionCreditoCliente } from "@/features/cliente/services/crud";

export function useExposicionCreditoCliente(clienteId: string | undefined | null, enabled = true) {
  return useQuery({
    queryKey: clientesKeys.exposicionCredito(clienteId ?? ""),
    enabled: !!clienteId && enabled,
    queryFn: () => fetchExposicionCreditoCliente(clienteId!),
    staleTime: 60 * 1000,
  });
}
