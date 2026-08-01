import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCxpAging,
  calcularTotalesAging,
  calcularTotalesPorMoneda,
  monedasPresentes,
  type CxpAgingRow,
  type CxpAgingTotals,
} from "@/features/cxp/services/cxpAging";
import { queryKeys } from "@/lib/query";

export interface UseCxpAgingResult {
  data: CxpAgingRow[] | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  monedas: string[];
  monedaActiva: string;
  setMoneda: (m: string) => void;
  rowsFiltradas: CxpAgingRow[];
  totales: CxpAgingTotals;
  totalesPorMoneda: Record<string, CxpAgingTotals>;
}

/**
 * QW3 — Aging CxP segmentado por moneda.
 * Devuelve las filas ya filtradas por la moneda activa (default: primera
 * moneda con saldo — típicamente MXN) y expone totales por moneda para KPIs.
 */
export function useCxpAging(fecha?: string): UseCxpAgingResult {
  const q = useQuery({
    queryKey: queryKeys.cxp.aging(fecha),
    queryFn: () => fetchCxpAging(fecha),
    staleTime: 60_000,
  });

  const rows = useMemo(() => q.data ?? [], [q.data]);
  const monedas = useMemo(() => monedasPresentes(rows), [rows]);
  const [monedaActiva, setMoneda] = useState<string>("MXN");

  // Si la moneda activa no existe en los datos, cae a la primera disponible.
  const monedaResuelta = monedas.includes(monedaActiva)
    ? monedaActiva
    : (monedas[0] ?? "MXN");

  const rowsFiltradas = useMemo(
    () => rows.filter((r) => r.moneda === monedaResuelta),
    [rows, monedaResuelta],
  );
  const totales = useMemo(() => calcularTotalesAging(rowsFiltradas), [rowsFiltradas]);
  const totalesPorMoneda = useMemo(() => calcularTotalesPorMoneda(rows), [rows]);

  return {
    data: q.data,
    isLoading: q.isLoading,
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
