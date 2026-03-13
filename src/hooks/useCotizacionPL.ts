import { useMemo } from "react";
import { calcularTotalesPL, type TotalesPL } from "@/lib/profitUtils";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";

/**
 * Calcula los totales de P&L (USD y MXN) a partir de las filas de costos internos.
 */
export function useCotizacionPL(costosInternos: FilaCostoLocal[]) {
  const costosUSD = useMemo(() => costosInternos.filter(c => c.moneda === "USD"), [costosInternos]);
  const costosMXN = useMemo(() => costosInternos.filter(c => c.moneda === "MXN"), [costosInternos]);
  const plUSD: TotalesPL = useMemo(() => calcularTotalesPL(costosUSD), [costosUSD]);
  const plMXN: TotalesPL = useMemo(() => calcularTotalesPL(costosMXN), [costosMXN]);

  return { costosUSD, costosMXN, plUSD, plMXN };
}
