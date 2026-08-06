/**
 * Anticipos con saldo a favor de un proveedor.
 * Alimenta el aviso "Aplicar anticipo" del detalle de factura y la tarjeta
 * de saldo a favor del detalle de proveedor.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { anticiposProveedorKeys } from "@/features/anticipos-proveedor/queryKeys";
import { fetchAnticiposDisponibles } from "@/features/anticipos-proveedor/services/anticiposProveedorService";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

export interface SaldoAFavorPorMoneda {
  moneda: string;
  disponible: number;
}

export function useAnticiposDisponibles(proveedorId?: string | null) {
  const q = useQuery({
    queryKey: anticiposProveedorKeys.disponibles(proveedorId),
    queryFn: () => fetchAnticiposDisponibles(proveedorId as string),
    enabled: Boolean(proveedorId),
    staleTime: 30_000,
  });

  const data: AnticipoProveedorRow[] = useMemo(
    () =>
      (q.data ?? []).map((a) => ({
        ...a,
        aplicado: Number(a.monto) - Number(a.saldo_disponible),
        disponible: Number(a.saldo_disponible),
      })),
    [q.data],
  );

  const porMoneda: SaldoAFavorPorMoneda[] = useMemo(() => {
    const acc = new Map<string, number>();
    for (const a of data) acc.set(a.moneda, (acc.get(a.moneda) ?? 0) + a.disponible);
    return [...acc.entries()].map(([moneda, disponible]) => ({ moneda, disponible }));
  }, [data]);

  return { ...q, data, porMoneda };
}
