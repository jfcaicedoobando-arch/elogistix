/**
 * Aging de Cuentas por Pagar — wrapper de la RPC `cxp_aging_proveedores`.
 * Devuelve antigüedad de saldos por proveedor en cubetas estándar (vigente, 1-30, 31-60, 61-90, >90 días).
 */
import { supabase } from "@/integrations/supabase/client";

export interface CxpAgingRow {
  proveedor_id: string;
  proveedor_nombre: string;
  saldo_total: number;
  vigente: number;
  d_1_30: number;
  d_31_60: number;
  d_61_90: number;
  mas_90: number;
  num_facturas: number;
}

export interface CxpAgingTotals {
  vigente: number;
  d_1_30: number;
  d_31_60: number;
  d_61_90: number;
  mas_90: number;
  total: number;
}

export async function fetchCxpAging(fecha?: string): Promise<CxpAgingRow[]> {
  const { data, error } = await supabase.rpc("cxp_aging_proveedores", {
    p_fecha: fecha ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    proveedor_id: r.proveedor_id,
    proveedor_nombre: r.proveedor_nombre,
    saldo_total: Number(r.saldo_total),
    vigente: Number(r.vigente),
    d_1_30: Number(r.d_1_30),
    d_31_60: Number(r.d_31_60),
    d_61_90: Number(r.d_61_90),
    mas_90: Number(r.mas_90),
    num_facturas: Number(r.num_facturas),
  }));
}

export function calcularTotalesAging(rows: CxpAgingRow[]): CxpAgingTotals {
  return rows.reduce<CxpAgingTotals>(
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
