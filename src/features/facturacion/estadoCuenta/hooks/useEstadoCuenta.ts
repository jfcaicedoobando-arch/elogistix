import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchEstadoCuenta,
  type EstadoCuentaFilters,
  type FacturaEstadoCuenta,
} from "../services/estadoCuenta";
import { calcularKpisEstadoCuenta } from "../services/estadoCuentaAggregates";

export function useEstadoCuenta(filters: EstadoCuentaFilters) {
  const query = useQuery({
    queryKey: [
      "estado-cuenta",
      [...filters.clienteIds].sort(),
      filters.desde ?? null,
      filters.hasta ?? null,
      filters.moneda ?? "todas",
      filters.soloConSaldo ?? false,
    ],
    queryFn: () => fetchEstadoCuenta(filters),
    enabled: filters.clienteIds.length > 0,
    staleTime: 30_000,
  });

  const rows: FacturaEstadoCuenta[] = useMemo(() => query.data ?? [], [query.data]);
  const kpis = useMemo(() => calcularKpisEstadoCuenta(rows), [rows]);

  return { ...query, rows, kpis };
}
