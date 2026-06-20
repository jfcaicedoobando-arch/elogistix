/**
 * Wrapper de React sobre `buildDesempenoChartRows` (lib/operaciones/desempenoChart).
 */
import { useMemo } from "react";
import type { OperadorData } from "@/features/operaciones/hooks/useOperacionesData";
import {
  buildDesempenoChartRows,
  ESTADOS_KEYS,
  type ChartRow,
} from "@/features/operaciones/domain/desempenoChart";

export { ESTADOS_KEYS };
export type { ChartRow };

export function useDesempenoChartData(operadores: OperadorData[]): ChartRow[] {
  return useMemo(() => buildDesempenoChartRows(operadores), [operadores]);
}
