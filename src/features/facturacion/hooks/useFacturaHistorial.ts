/**
 * useFacturaHistorial — historial de eventos de una factura (bitácora
 * `facturas` y `facturacion`) leído mediante RPC segura.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchHistorialFacturaEmitida } from "@/features/facturacion/services/historialFactura";
import { queryKeys } from "@/lib/query";

export function useFacturaHistorial(facturaId: string) {
  return useQuery({
    queryKey: queryKeys.facturas.historial(facturaId),
    queryFn: () => fetchHistorialFacturaEmitida(facturaId, 50),
    enabled: Boolean(facturaId),
  });
}
