/**
 * Agregados puros de Cobranza (KPIs y saldos por moneda).
 * Extraído de `cobranza.ts` en 12.61.18 (Sprint 2.1, Power-of-10 #1: ≤200 líneas).
 * Sin acceso a Supabase ni I/O: testeable de forma aislada.
 */
import { sumarMontos } from "@/lib/financial/financialUtils";
import type { FacturaCobranza } from "./cobranza";
import { logger } from "@/lib/observability/logger";

export interface KPIsCobranza {
  total_mxn: number;
  total_usd: number;
  vencido_mxn: number;
  vencido_usd: number;
  por_vencer_7d_mxn: number;
  por_vencer_7d_usd: number;
  facturas_vencidas: number;
}

export interface SaldosPorMoneda {
  saldoPendienteMXN: number;
  saldoPendienteUSD: number;
  /** Saldos por código de moneda no canónica (EUR, etc.) que NO se mezclan con los buckets oficiales. */
  porMoneda: Record<string, number>;
  /** Cantidad de filas con moneda fuera de {MXN,USD} que fueron descartadas de los buckets canónicos. */
  descartadas: number;
}

/**
 * Agrupa saldos pendientes por moneda SIN mezclar divisas.
 * Filas con `saldo <= 0` se ignoran. Filas con moneda ajena a {MXN,USD} se
 * registran aparte en `porMoneda` y NUNCA contaminan los buckets canónicos.
 */
export function agruparSaldosPorMoneda(filas: FacturaCobranza[]): SaldosPorMoneda {
  const bucketMXN: number[] = [];
  const bucketUSD: number[] = [];
  const otros: Record<string, number[]> = {};
  let descartadas = 0;

  for (const f of filas) {
    if (f.saldo <= 0) continue;
    if (f.moneda === "MXN") bucketMXN.push(f.saldo);
    else if (f.moneda === "USD") bucketUSD.push(f.saldo);
    else {
      const key = String(f.moneda ?? "DESCONOCIDA");
      (otros[key] ??= []).push(f.saldo);
      descartadas++;
    }
  }

  const porMoneda: Record<string, number> = {};
  for (const [k, arr] of Object.entries(otros)) porMoneda[k] = sumarMontos(arr);

  if (descartadas > 0) {
    logger.warn("cobranza", `${descartadas} factura(s) con moneda no canónica descartada(s) de los buckets MXN/USD:`,
      Object.keys(otros),
    );
  }

  return {
    saldoPendienteMXN: sumarMontos(bucketMXN),
    saldoPendienteUSD: sumarMontos(bucketUSD),
    porMoneda,
    descartadas,
  };
}

export function calcularKPIs(filas: FacturaCobranza[]): KPIsCobranza {
  const vencidoMXN: number[] = [];
  const vencidoUSD: number[] = [];
  const porVencerMXN: number[] = [];
  const porVencerUSD: number[] = [];
  let facturas_vencidas = 0;

  for (const f of filas) {
    if (f.saldo <= 0) continue;
    if (f.moneda !== "MXN" && f.moneda !== "USD") continue;
    const esUsd = f.moneda === "USD";
    if (f.estatus_cobranza === "Vencida") {
      facturas_vencidas++;
      (esUsd ? vencidoUSD : vencidoMXN).push(f.saldo);
    }
    if (f.dias_vencido <= 0 && f.dias_vencido >= -7) {
      (esUsd ? porVencerUSD : porVencerMXN).push(f.saldo);
    }
  }

  const { saldoPendienteMXN, saldoPendienteUSD } = agruparSaldosPorMoneda(filas);

  return {
    total_mxn: saldoPendienteMXN,
    total_usd: saldoPendienteUSD,
    vencido_mxn: sumarMontos(vencidoMXN),
    vencido_usd: sumarMontos(vencidoUSD),
    por_vencer_7d_mxn: sumarMontos(porVencerMXN),
    por_vencer_7d_usd: sumarMontos(porVencerUSD),
    facturas_vencidas,
  };
}
