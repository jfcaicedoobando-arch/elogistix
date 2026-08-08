/**
 * Aging de Cuentas por Cobrar — wrapper de la RPC `cxc_aging_clientes`.
 *
 * v13.462.0: la RPC devuelve una fila por (cliente, moneda) para que MXN, USD
 * y EUR NO se sumen entre sí (mismo criterio que el aging de CxP).
 * Cubetas estándar compartidas: vigente, 1-30, 31-60, 61-90, +90 días.
 */
import { supabase } from "@/integrations/supabase/client";
import { todayLocalISO } from "@/lib/date/today";
import { monedasPresentes } from "@/lib/aging/buckets";

export interface CxcAgingRow {
  cliente_id: string;
  cliente_nombre: string;
  moneda: string;
  saldo_total: number;
  vigente: number;
  d_1_30: number;
  d_31_60: number;
  d_61_90: number;
  mas_90: number;
  num_facturas: number;
}

export interface CxcAgingTotals {
  vigente: number;
  d_1_30: number;
  d_31_60: number;
  d_61_90: number;
  mas_90: number;
  total: number;
}

const EMPTY_TOTALS: CxcAgingTotals = {
  vigente: 0, d_1_30: 0, d_31_60: 0, d_61_90: 0, mas_90: 0, total: 0,
};

export async function fetchCxcAging(fecha?: string): Promise<CxcAgingRow[]> {
  const { data, error } = await supabase.rpc("cxc_aging_clientes", {
    p_fecha: fecha ?? todayLocalISO(),
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    cliente_id: r.cliente_id,
    cliente_nombre: r.cliente_nombre,
    moneda: (r.moneda ?? "MXN").toUpperCase(),
    saldo_total: Number(r.saldo_total),
    vigente: Number(r.vigente),
    d_1_30: Number(r.d_1_30),
    d_31_60: Number(r.d_31_60),
    d_61_90: Number(r.d_61_90),
    mas_90: Number(r.mas_90),
    num_facturas: Number(r.num_facturas),
  }));
}

/**
 * Suma cubetas SIN mezclar monedas: quien la usa debe filtrar por moneda antes.
 * Si se le pasan monedas distintas el resultado no es interpretable.
 */
export function calcularTotalesAging(rows: readonly CxcAgingRow[]): CxcAgingTotals {
  return (rows ?? []).reduce<CxcAgingTotals>(
    (acc, r) => ({
      vigente: acc.vigente + r.vigente,
      d_1_30: acc.d_1_30 + r.d_1_30,
      d_31_60: acc.d_31_60 + r.d_31_60,
      d_61_90: acc.d_61_90 + r.d_61_90,
      mas_90: acc.mas_90 + r.mas_90,
      total: acc.total + r.saldo_total,
    }),
    { ...EMPTY_TOTALS },
  );
}

/** Totales agrupados por moneda (`MXN`, `USD`, `EUR`, …). */
export function calcularTotalesPorMoneda(
  rows: readonly CxcAgingRow[],
): Record<string, CxcAgingTotals> {
  const map: Record<string, CxcAgingTotals> = {};
  for (const r of rows ?? []) {
    const acc = map[r.moneda] ?? { ...EMPTY_TOTALS };
    acc.vigente += r.vigente;
    acc.d_1_30 += r.d_1_30;
    acc.d_31_60 += r.d_31_60;
    acc.d_61_90 += r.d_61_90;
    acc.mas_90 += r.mas_90;
    acc.total += r.saldo_total;
    map[r.moneda] = acc;
  }
  return map;
}

export { monedasPresentes };
