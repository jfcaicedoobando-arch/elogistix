/**
 * CANON ÚNICO del aging (antigüedad de saldos) expresado en MXN.
 *
 * El dashboard financiero tenía su propia escala (0-15 / 16-30 / …) mientras
 * `/cobranza/aging` y `/reportes/cartera` usaban la escala oficial
 * (1-30 / 31-60 / 61-90 / +90): la misma deuda aparecía repartida distinto
 * según la pantalla. Aquí se calcula una sola vez, con los cortes de
 * `@/lib/aging/buckets` y la conversión oficial `aMxn`.
 */
import { CUBETAS_AGING, bucketDeDias, type CubetaAging } from "@/lib/aging/buckets";
import { aMxn } from "@/lib/financial/convertir";
import { roundMoney } from "@/lib/financial/financialUtils";

export type AgingMxn = Record<CubetaAging, number>;

/** Cubetas vencidas (todas menos "vigente"), en orden de severidad. */
export const CUBETAS_VENCIDAS: readonly CubetaAging[] = CUBETAS_AGING.filter(
  (c) => c !== "vigente",
);

export interface ResumenAgingMxn {
  buckets: AgingMxn;
  /** Suma de las cubetas vencidas (excluye "vigente"). */
  totalVencido: number;
  /** Facturas en moneda extranjera excluidas por falta de TC confiable. */
  sinTipoCambio: number;
}

export function agingVacio(): AgingMxn {
  return CUBETAS_AGING.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {} as AgingMxn);
}

export interface FilaAging {
  saldo: number | null | undefined;
  moneda: string | null | undefined;
  tipo_cambio?: number | null;
  dias_vencido: number | null | undefined;
}

/** Reparte saldos en las cubetas oficiales, convirtiendo cada uno a MXN. */
export function resumirAgingMxn(rows: readonly FilaAging[]): ResumenAgingMxn {
  const buckets = agingVacio();
  let sinTipoCambio = 0;

  for (const f of rows ?? []) {
    const saldo = Number(f.saldo ?? 0) || 0;
    if (saldo <= 0) continue;
    const conv = aMxn(saldo, f.moneda, f.tipo_cambio);
    if (!conv.completo) {
      sinTipoCambio += 1;
      continue;
    }
    buckets[bucketDeDias(Number(f.dias_vencido ?? 0) || 0)] += conv.monto;
  }

  for (const c of CUBETAS_AGING) buckets[c] = roundMoney(buckets[c]);
  const totalVencido = roundMoney(
    CUBETAS_VENCIDAS.reduce((sum, c) => sum + buckets[c], 0),
  );

  return { buckets, totalVencido, sinTipoCambio };
}
