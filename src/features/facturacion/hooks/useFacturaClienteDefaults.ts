/**
 * useFacturaClienteDefaults — obtiene los correos preferidos (CC y
 * destinatarios) guardados para el cliente de una factura, usados para
 * precargar el diálogo de envío por correo.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDefaultsFacturacionCliente } from "@/features/facturacion/services";
import { queryKeys } from "@/lib/query";

export function useFacturaClienteDefaults(clienteId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.facturacion.clienteDefaults(clienteId),
    enabled: !!clienteId && enabled,
    queryFn: () => fetchDefaultsFacturacionCliente(clienteId!),
    staleTime: 30_000,
  });
}
