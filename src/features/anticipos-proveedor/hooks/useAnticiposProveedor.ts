/** Lista de anticipos a proveedor con saldo/aplicado/disponible para la bandeja. */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { anticiposProveedorKeys } from "@/features/anticipos-proveedor/queryKeys";
import {
  fetchAnticiposProveedor,
  type AnticiposFiltro,
  type AnticipoConProveedor,
} from "@/features/anticipos-proveedor/services/anticiposProveedorService";

export interface AnticipoProveedorRow extends AnticipoConProveedor {
  aplicado: number;
  disponible: number;
  /** Monto que el proveedor regresó (MNY P1.3: nunca es "aplicado"). */
  devuelto: number;
}

export function toRow(a: AnticipoConProveedor): AnticipoProveedorRow {
  // MNY P1.3: `monto - saldo_disponible` incluía el monto devuelto y lo
  // reportaba como aplicado a facturas. La devolución se descuenta aparte.
  const devuelto = Number(a.monto_devuelto ?? 0);
  const aplicado = Math.max(0, Number(a.monto) - Number(a.saldo_disponible) - devuelto);
  return { ...a, aplicado, disponible: Number(a.saldo_disponible), devuelto };
}


export function useAnticiposProveedor(filtros: AnticiposFiltro = {}) {
  const key = useMemo(
    () => ({
      estado: filtros.estado ?? null,
      proveedorId: filtros.proveedorId ?? null,
      sinEmbarque: filtros.sinEmbarque ?? false,
    }),
    [filtros.estado, filtros.proveedorId, filtros.sinEmbarque],
  );
  const q = useQuery({
    queryKey: anticiposProveedorKeys.list(key),
    queryFn: () => fetchAnticiposProveedor(filtros),
    staleTime: 30_000,
  });
  const data = useMemo(() => (q.data ?? []).map(toRow), [q.data]);
  return { ...q, data };
}
