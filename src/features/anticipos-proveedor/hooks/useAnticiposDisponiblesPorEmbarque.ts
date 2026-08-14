/**
 * Anticipos con saldo a favor de un proveedor que están ligados a un embarque
 * concreto. Alimenta el aviso de cruce al capturar la factura del proveedor.
 */
import { useMemo } from "react";
import { useAnticiposDisponibles } from "@/features/anticipos-proveedor/hooks/useAnticiposDisponibles";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

export interface SaldoAnticipoEmbarque {
  moneda: string;
  disponible: number;
}

export function useAnticiposDisponiblesPorEmbarque(
  proveedorId?: string | null,
  embarqueId?: string | null,
) {
  const { data, isLoading } = useAnticiposDisponibles(proveedorId);

  const anticipos: AnticipoProveedorRow[] = useMemo(
    () => (embarqueId ? data.filter((a) => a.embarque_id === embarqueId) : []),
    [data, embarqueId],
  );

  const porMoneda: SaldoAnticipoEmbarque[] = useMemo(() => {
    const acc = new Map<string, number>();
    for (const a of anticipos) acc.set(a.moneda, (acc.get(a.moneda) ?? 0) + a.disponible);
    return [...acc.entries()].map(([moneda, disponible]) => ({ moneda, disponible }));
  }, [anticipos]);

  return { anticipos, porMoneda, isLoading };
}
