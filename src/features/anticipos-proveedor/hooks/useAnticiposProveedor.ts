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
}

function toRow(a: AnticipoConProveedor): AnticipoProveedorRow {
  const aplicado = Number(a.monto) - Number(a.saldo_disponible);
  return { ...a, aplicado, disponible: Number(a.saldo_disponible) };
}

export function useAnticiposProveedor(filtros: AnticiposFiltro = {}) {
  const key = useMemo(
    () => ({ estado: filtros.estado ?? null, proveedorId: filtros.proveedorId ?? null }),
    [filtros.estado, filtros.proveedorId],
  );
  const q = useQuery({
    queryKey: anticiposProveedorKeys.list(key),
    queryFn: () => fetchAnticiposProveedor(filtros),
    staleTime: 30_000,
  });
  const data = useMemo(() => (q.data ?? []).map(toRow), [q.data]);
  return { ...q, data };
}
