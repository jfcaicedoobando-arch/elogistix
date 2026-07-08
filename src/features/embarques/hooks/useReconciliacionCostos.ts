/**
 * Devuelve la reconciliación cotizado vs facturado por concepto de costo del embarque.
 * Incluye las facturas de proveedor vinculadas (folio, fecha, monto, estado de pago).
 */
import { useQuery } from "@tanstack/react-query";
import { fetchReconciliacionEmbarque } from "@/features/embarques/services/reconciliacionCostos";

export function useReconciliacionCostos(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ["embarques", "reconciliacion-costos", embarqueId],
    queryFn: () => fetchReconciliacionEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}
