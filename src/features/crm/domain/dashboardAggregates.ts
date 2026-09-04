/**
 * Agregaciones puras para el Dashboard del CRM.
 * Extraído de `hooks/crm/useCrmDashboard.ts` (Power of 10: ≤200 LOC, testabilidad).
 */

import { isoUtcDay } from "@/lib/date/mx";
import { agruparMontosPorMonedaOrdenado, type SubtotalMoneda } from "@/features/crm/domain/montosPorMoneda";

export interface OpRow {
  id: string;
  nombre: string;
  cliente_nombre: string;
  monto_estimado: number;
  moneda: string;
  probabilidad: number;
  fecha_estimada_cierre: string | null;
  etapa_id: string;
}

export interface EtapaRow {
  id: string;
  nombre: string;
  color: string;
  tipo: string;
}

export interface TopDeal {
  id: string;
  nombre: string;
  cliente_nombre: string;
  monto_estimado: number;
  moneda: string;
  probabilidad: number;
  ponderado: number;
}

export interface EmbudoRow {
  etapa_id: string;
  nombre: string;
  color: string;
  tipo: string;
  count: number;
  monto: number;
}

export function isoDaysFromNow(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return isoUtcDay(t);
}

export function computePipelinePonderado(ops: OpRow[]): number {
  return ops.reduce(
    (s, o) => s + Number(o.monto_estimado ?? 0) * (Number(o.probabilidad ?? 0) / 100),
    0,
  );
}

/**
 * Pipeline ponderado desglosado por moneda: NO suma monedas distintas entre
 * sí (no hay TC histórico canónico). Ver `montosPorMoneda.ts`.
 */
export function computePipelinePonderadoPorMoneda(ops: OpRow[]): SubtotalMoneda[] {
  return agruparMontosPorMonedaOrdenado(
    ops.map((o) => ({
      monto: Number(o.monto_estimado ?? 0) * (Number(o.probabilidad ?? 0) / 100),
      moneda: o.moneda,
    })),
  );
}

export function computeTopDeals(ops: OpRow[], limit = 5): TopDeal[] {
  return [...ops]
    .map((o) => ({
      id: o.id,
      nombre: o.nombre,
      cliente_nombre: o.cliente_nombre,
      monto_estimado: Number(o.monto_estimado ?? 0),
      moneda: o.moneda,
      probabilidad: Number(o.probabilidad ?? 0),
      ponderado: Number(o.monto_estimado ?? 0) * (Number(o.probabilidad ?? 0) / 100),
    }))
    .sort((a, b) => b.ponderado - a.ponderado)
    .slice(0, limit);
}

export function computeEmbudo(ops: OpRow[], etapas: EtapaRow[]): EmbudoRow[] {
  return etapas.map((et) => {
    const stageOps = ops.filter((o) => o.etapa_id === et.id);
    return {
      etapa_id: et.id,
      nombre: et.nombre,
      color: et.color,
      tipo: et.tipo,
      count: stageOps.length,
      monto: stageOps.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0),
    };
  });
}
