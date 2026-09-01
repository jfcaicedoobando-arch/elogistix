/**
 * Manipulación de buckets para `computeForecast`.
 * Extraído de `forecast.ts` para mantener complejidad <15.
 */
import type { EtapaTipo, ForecastBucket } from "./forecast";

interface BucketDelta {
  abierta: boolean;
  ganada: boolean;
  monto: number;
  ponderado: number;
}

export function classifyEtapa(tipo: EtapaTipo | undefined): { abierta: boolean; ganada: boolean } {
  return { abierta: tipo === "abierta", ganada: tipo === "ganada" };
}

export function makeBucket(key: string, label: string, moneda: string): ForecastBucket {
  return { key, label, moneda, pipeline: 0, ponderado: 0, ganado: 0, count: 0 };
}

export function applyDelta(b: ForecastBucket, d: BucketDelta): void {
  b.count += 1;
  if (d.abierta) {
    b.pipeline += d.monto;
    b.ponderado += d.ponderado;
  }
  if (d.ganada) b.ganado += d.monto;
}

export type { BucketDelta };
