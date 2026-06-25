/**
 * Devuelve el conjunto de `concepto_costo.id` (del embarque dado) que ya tienen
 * al menos una factura de proveedor vinculada. Sirve para derivar el estado de
 * liquidación a 3 valores en la UI.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchCostosConFactura } from "@/features/embarques/services/costosConFactura";

export function useCostosConFactura(embarqueId: string | undefined) {
  return useQuery({
    queryKey: ["embarques", "costos-con-factura", embarqueId],
    queryFn: () => fetchCostosConFactura(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
}
