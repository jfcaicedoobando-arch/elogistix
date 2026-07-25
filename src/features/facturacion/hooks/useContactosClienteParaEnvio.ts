/**
 * useContactosClienteParaEnvio — Obtiene los contactos + email del cliente
 * para elegir destinatario al enviar un CFDI. Ordena preferentemente los
 * contactos de facturación/cobranza primero.
 */
import { useQuery } from "@tanstack/react-query";
import { facturacion as facturacionKeys } from "@/features/facturacion/queryKeys";
import {
  fetchContactosClienteEnvio,
  type ContactoEnvio,
  type DatosEnvioCliente,
} from "@/features/facturacion/services/contactosClienteEnvio";

export type { ContactoEnvio, DatosEnvioCliente };

export function useContactosClienteParaEnvio(clienteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: facturacionKeys.contactosClienteEnvio(clienteId),
    queryFn: () => fetchContactosClienteEnvio(clienteId!),
    enabled: enabled && Boolean(clienteId),
    staleTime: 60_000,
  });
}
