/**
 * Saldo abierto agregado de un proveedor en una moneda dada (v13.393.0).
 * Alimenta la vista previa del impacto del pago en el saldo del proveedor.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchFacturasCxP } from "@/features/cxp/services";
import { cxp as cxpKeys } from "@/features/cxp/queryKeys";

export interface SaldoAbiertoProveedor {
  saldoTotal: number;
  facturasAbiertas: number;
}

const ESTATUS_ABIERTOS = new Set(["Vigente", "Parcial", "Por vencer", "Vencida"]);

export function useSaldoProveedorCxp(
  proveedorId: string | null,
  moneda: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: cxpKeys.facturasAbiertasProveedor(
      proveedorId ? `${proveedorId}:${moneda ?? "todas"}` : null,
    ),
    queryFn: () => fetchFacturasCxP({ proveedor_id: proveedorId ?? undefined }),
    enabled: enabled && Boolean(proveedorId),
    staleTime: 15_000,
    select: (rows): SaldoAbiertoProveedor => {
      const abiertas = rows.filter(
        (f) =>
          ESTATUS_ABIERTOS.has(f.estatus) &&
          f.saldo > 0.01 &&
          (!moneda || f.moneda === moneda),
      );
      return {
        saldoTotal: abiertas.reduce((acc, f) => acc + f.saldo, 0),
        facturasAbiertas: abiertas.length,
      };
    },
  });
}
