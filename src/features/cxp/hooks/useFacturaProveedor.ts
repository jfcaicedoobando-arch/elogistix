import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchFacturaProveedor, type FacturaCxP } from "@/features/cxp/services";

/**
 * Lee una factura individual de CxP y la mantiene fresca en cache.
 *
 * Se usa principalmente desde el diálogo "Detalle de pagos": el padre
 * normalmente pasa un snapshot (la fila tal como la dibuja la lista),
 * pero ese snapshot deja de reflejar la realidad cuando la fila se
 * filtra fuera de la lista (p.ej. al aprobar una factura mientras el
 * filtro activo es "Por aprobar"). Este hook resuelve ese gap
 * consultando la fila directa por id; en mutaciones (aprobar / pagar /
 * notas de crédito) basta con invalidar `queryKeys.cxp.factura(id)`
 * para que el diálogo se rehidrate.
 */
export function useFacturaProveedor(
  id: string | null | undefined,
  initialData?: FacturaCxP,
) {
  return useQuery({
    queryKey: queryKeys.cxp.factura(id ?? null),
    queryFn: () => fetchFacturaProveedor(id as string),
    enabled: !!id,
    initialData: initialData && id ? initialData : undefined,
    staleTime: 10_000,
  });
}
