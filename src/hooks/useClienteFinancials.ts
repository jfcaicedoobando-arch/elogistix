import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchClienteFinancials } from "@/services/clienteFinancialsService";

export function useClienteFinancials(clienteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clienteFinancials.byCliente(clienteId),
    queryFn: () => fetchClienteFinancials(clienteId!),
    enabled: !!clienteId,
  });
}
