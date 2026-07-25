/**
 * Aging de Cuentas por Cobrar — wrapper de la RPC `cxc_aging_clientes`.
 * Devuelve antigüedad de saldos por cliente en cubetas estándar (vigente, 1-30, 31-60, 61-90, >90 días).
 */
import { supabase } from "@/integrations/supabase/client";
import { todayLocalISO } from "@/lib/date/today";

export interface CxcAgingRow {
  cliente_id: string;
  cliente_nombre: string;
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

export async function fetchCxcAging(fecha?: string): Promise<CxcAgingRow[]> {
  const { data, error } = await supabase.rpc("cxc_aging_clientes", {
    p_fecha: fecha ?? todayLocalISO(),
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    cliente_id: r.cliente_id,
    cliente_nombre: r.cliente_nombre,
    saldo_total: Number(r.saldo_total),
    vigente: Number(r.vigente),
    d_1_30: Number(r.d_1_30),
    d_31_60: Number(r.d_31_60),
    d_61_90: Number(r.d_61_90),
    mas_90: Number(r.mas_90),
    num_facturas: Number(r.num_facturas),
  }));
}

export function calcularTotalesAging(rows: CxcAgingRow[]): CxcAgingTotals {
  return rows.reduce<CxcAgingTotals>(
    (acc, r) => ({
      vigente: acc.vigente + r.vigente,
      d_1_30: acc.d_1_30 + r.d_1_30,
      d_31_60: acc.d_31_60 + r.d_31_60,
      d_61_90: acc.d_61_90 + r.d_61_90,
      mas_90: acc.mas_90 + r.mas_90,
      total: acc.total + r.saldo_total,
    }),
    { vigente: 0, d_1_30: 0, d_31_60: 0, d_61_90: 0, mas_90: 0, total: 0 },
  );
}
