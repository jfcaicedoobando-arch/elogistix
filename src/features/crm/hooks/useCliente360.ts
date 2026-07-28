/**
 * Vista 360° de un cliente para el tab CRM dentro de ClienteDetalle (Sprint D).
 * I/O delegada a `services/crm/cliente360`.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchCliente360, type Cliente360Resumen } from "@/features/crm/services/cliente360";

export type {  Cliente360Resumen } from "@/features/crm/services/cliente360";

export function useCliente360(clienteId: string | undefined) {
  return useQuery<Cliente360Resumen>({
    queryKey: queryKeys.crm.cliente360(clienteId ?? ""),
    enabled: !!clienteId,
    queryFn: () => fetchCliente360(clienteId!),
  });
}
