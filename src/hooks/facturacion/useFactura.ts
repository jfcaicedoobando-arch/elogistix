/**
 * useFactura — detalle completo de una factura por id. RLS restringe por
 * `organization_id`; si el usuario no tiene acceso, devuelve `null`.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchFacturaById, type FacturaDetalle } from "@/services/facturas/detail";

export type { FacturaDetalle };

export function useFactura(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.facturas.detail(id),
    queryFn: () => fetchFacturaById(id!),
    enabled: !!id,
  });
}
