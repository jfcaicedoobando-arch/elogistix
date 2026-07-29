/**
 * useNotasCreditoDeFactura — lista las notas de crédito ligadas a una
 * factura para mostrarlas en la sección de detalle.
 */
import { useQuery } from "@tanstack/react-query";
import { listarNotasCreditoPorFactura } from "@/features/facturacion/services/notasCredito";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";

export function useNotasCreditoDeFactura(facturaId: string) {
  return useQuery({
    queryKey: facturasKeys.notasCredito(facturaId),
    queryFn: () => listarNotasCreditoPorFactura(facturaId),
  });
}
