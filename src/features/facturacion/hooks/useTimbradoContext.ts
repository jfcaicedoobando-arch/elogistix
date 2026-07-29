/**
 * Contexto de datos del diálogo de timbrado: factura + cliente fiscal +
 * defaults de facturación del cliente. Extraído de `DialogTimbrarFactura`
 * (O7) para bajar la complejidad del componente y eliminar su
 * `eslint-disable complexity`.
 */
import { useQuery } from "@tanstack/react-query";
import { useFactura } from "@/features/facturacion/hooks/useFactura";
import {
  fetchClienteFiscal,
  fetchDefaultsFacturacionCliente,
  type ClienteFiscalRow,
  type DefaultsFacturacionCliente,
} from "@/features/facturacion/services";
import { queryKeys } from "@/lib/query";

export function useTimbradoContext(facturaId: string | null) {
  const { data: factura } = useFactura(facturaId ?? undefined);

  const { data: cliente } = useQuery<ClienteFiscalRow | null>({
    queryKey: queryKeys.facturacion.clienteFiscal(factura?.cliente_id),
    enabled: !!factura?.cliente_id,
    queryFn: () => fetchClienteFiscal(factura!.cliente_id),
  });

  const { data: defaults } = useQuery<DefaultsFacturacionCliente | null>({
    queryKey: queryKeys.facturacion.clienteDefaults(factura?.cliente_id),
    enabled: !!factura?.cliente_id,
    queryFn: () => fetchDefaultsFacturacionCliente(factura!.cliente_id),
    staleTime: 30_000,
  });

  return { factura, cliente, defaults };
}
