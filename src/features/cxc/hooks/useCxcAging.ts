import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCxcAging,
  calcularTotalesAging,
  calcularTotalesPorMoneda,
  monedasPresentes,
  type CxcAgingRow,
  type CxcAgingTotals,
} from "@/features/cxc/services/cxcAging";
import { queryKeys } from "@/lib/query";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";

export interface UseCxcAgingResult {
  data: CxcAgingRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  monedas: string[];
  monedaActiva: string;
  setMoneda: (m: string) => void;
  rowsFiltradas: CxcAgingRow[];
  totales: CxcAgingTotals;
  totalesPorMoneda: Record<string, CxcAgingTotals>;
}

/**
 * Aging de CxC segmentado por moneda y calculado a una fecha de corte.
 * Devuelve las filas ya filtradas por la moneda activa.
 */
export function useCxcAging(fecha?: string): UseCxcAgingResult {
  const { organizationId } = useOrgFilter();
  const q = useQuery({
    queryKey: [...queryKeys.cxc.aging(fecha), organizationId],
    queryFn: () => fetchCxcAging(fecha, organizationId),
    staleTime: 60_000,
  });

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const monedas = useMemo(() => monedasPresentes(rows), [rows]);
  const [monedaActiva, setMoneda] = useState<string>("MXN");

  const monedaResuelta = monedas.includes(monedaActiva) ? monedaActiva : (monedas[0] ?? "MXN");

  const rowsFiltradas = useMemo(
    () => rows.filter((r) => r.moneda === monedaResuelta),
    [rows, monedaResuelta],
  );
  const totales = useMemo(() => calcularTotalesAging(rowsFiltradas), [rowsFiltradas]);
  const totalesPorMoneda = useMemo(() => calcularTotalesPorMoneda(rows), [rows]);

  return {
    data: q.data,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
    monedas,
    monedaActiva: monedaResuelta,
    setMoneda,
    rowsFiltradas,
    totales,
    totalesPorMoneda,
  };
}
