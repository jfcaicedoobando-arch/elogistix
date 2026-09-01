/**
 * Facturas ABIERTAS (saldo > 0, no canceladas) de un proveedor.
 * Usado por SelectorFacturaAbierta / AplicarAnticipoDialog.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchFacturasCxP } from "@/features/cxp/services";
import { cxp as cxpKeys } from "@/features/cxp/queryKeys";

const OPEN_ESTATUS = new Set(["Vigente", "Parcial", "Por vencer", "Vencida"]);

export function useFacturasAbiertasProveedor(proveedorId: string | null) {
  return useQuery({
    queryKey: cxpKeys.facturasAbiertasProveedor(proveedorId),
    queryFn: () => fetchFacturasCxP({ proveedor_id: proveedorId ?? undefined }),
    enabled: Boolean(proveedorId),
    select: (rows) => rows.filter((f) => OPEN_ESTATUS.has(f.estatus) && f.saldo > 0.01),
    staleTime: 15_000,
  });
}
