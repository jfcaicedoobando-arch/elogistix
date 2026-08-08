/**
 * Hook del detalle de un pago (movimiento bancario + facturas aplicadas).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchPagoDetalle } from "@/features/tesoreria/services/pagoDetalle";
import type { RefPago } from "@/features/tesoreria/domain/pagoDetalle";

export function usePagoDetalle(ref: RefPago | null) {
  return useQuery({
    queryKey: queryKeys.tesoreria.pagoDetalle(ref?.tipo ?? null, ref?.id ?? null),
    queryFn: () => fetchPagoDetalle(ref as RefPago),
    enabled: !!ref?.id,
    staleTime: 30_000,
  });
}
