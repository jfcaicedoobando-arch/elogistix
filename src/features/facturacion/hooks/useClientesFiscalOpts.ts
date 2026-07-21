import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchClientesFiscalOpts,
  type ClienteFiscalOpt,
} from "@/features/facturacion/services/clientesFiscalOpts";

export type { ClienteFiscalOpt };

/**
 * Query wrapper del catálogo fiscal de clientes usado por los diálogos de
 * facturación manual. La consulta vive en `services/clientesFiscalOpts`.
 */
export function useClientesFiscalOpts(organizationId: string | null, enabled: boolean) {
  return useQuery<ClienteFiscalOpt[]>({
    queryKey: queryKeys.facturacion.clientesFiscalOpts(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: fetchClientesFiscalOpts,
  });
}
