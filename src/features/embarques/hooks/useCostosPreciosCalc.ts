/**
 * Hook puro de cálculo para el step de Costos/Precios del wizard de embarques.
 * Suma estricta vía `sumarEnMoneda` con detección de filas en moneda mixta;
 * cae a un resumen laxo cuando falta TC para no romper el render.
 * Extraído de `StepCostosPrecios.tsx` en 12.61.18 (Sprint 2.1, Power-of-10 #1).
 */
import { useMemo } from "react";
import { sumarEnMoneda } from "@/lib/financial/costosUSD";

interface Item { monto: number; moneda: string }

export interface CalcMoneda {
  total: number;
  filasMixtas: Array<{ index: number; moneda: string }>;
  homogenea: boolean;
  tcMissing: boolean;
}

const TARGET_MONEDA = "USD" as const;

function calcular(items: Item[], tcUSD: number, tcEUR: number): CalcMoneda {
  try {
    return { ...sumarEnMoneda(items, TARGET_MONEDA, tcUSD, tcEUR), tcMissing: false };
  } catch {
    return {
      total: 0,
      filasMixtas: items
        .map((it, index) => ({ index, moneda: it.moneda }))
        .filter((f) => f.moneda !== TARGET_MONEDA),
      homogenea: false,
      tcMissing: true,
    };
  }
}

export function useCostosPreciosCalc(
  conceptosCosto: Array<{ monto: number; moneda: string }>,
  conceptosVenta: Array<{ precioUnitario: number; moneda: string }>,
  tcUSD: number,
  tcEUR: number,
) {
  const costoCalc = useMemo<CalcMoneda>(() => {
    const items: Item[] = conceptosCosto.map((c) => ({ monto: c.monto, moneda: c.moneda }));
    return calcular(items, tcUSD, tcEUR);
  }, [conceptosCosto, tcUSD, tcEUR]);

  const ventaCalc = useMemo<CalcMoneda>(() => {
    const items: Item[] = conceptosVenta.map((v) => ({ monto: v.precioUnitario, moneda: v.moneda }));
    return calcular(items, tcUSD, tcEUR);
  }, [conceptosVenta, tcUSD, tcEUR]);

  const costoMixtoIdx = useMemo(
    () => new Set(costoCalc.filasMixtas.map((f) => f.index)),
    [costoCalc.filasMixtas],
  );
  const ventaMixtoIdx = useMemo(
    () => new Set(ventaCalc.filasMixtas.map((f) => f.index)),
    [ventaCalc.filasMixtas],
  );

  return { costoCalc, ventaCalc, costoMixtoIdx, ventaMixtoIdx };
}
