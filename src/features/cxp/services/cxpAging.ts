/**
 * Aging de Cuentas por Pagar — wrapper de la RPC `cxp_aging_proveedores`.
 * QW3 (v13.315.9): la RPC ahora devuelve una fila por (proveedor, moneda) para
 * que MXN, USD y EUR no se sumen entre sí en el reporte de antigüedad.
 */
import { supabase } from "@/integrations/supabase/client";
import { todayLocalISO } from "@/lib/date/today";

export type MonedaAging = "MXN" | "USD" | "EUR" | string;

export interface CxpAgingRow {
  proveedor_id: string;
  proveedor_nombre: string;
  moneda: MonedaAging;
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

const EMPTY_TOTALS: CxpAgingTotals = {
  vigente: 0, d_1_30: 0, d_31_60: 0, d_61_90: 0, mas_90: 0, total: 0,
};

export async function fetchCxpAging(
  fecha?: string,
  organizationId?: string | null,
): Promise<CxpAgingRow[]> {
  const { data, error } = await supabase.rpc("cxp_aging_proveedores", {
    p_fecha: fecha ?? todayLocalISO(),
    p_org: organizationId ?? undefined,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    proveedor_id: r.proveedor_id,
    proveedor_nombre: r.proveedor_nombre,
    moneda: (r.moneda ?? "MXN") as MonedaAging,
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
 * Suma cubetas de un conjunto de filas SIN mezclar monedas.
 * Nota: quien la use debe filtrar por moneda antes; si se le pasan monedas
 * distintas devuelve una suma numérica que no es interpretable económicamente.
 */
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
    { ...EMPTY_TOTALS },
  );
}

/**
 * QW3 — Totales agrupados por moneda. La clave es la moneda (`MXN`, `USD`, `EUR`, …)
 * y el valor son las cubetas sumadas para esa moneda.
 */
export function calcularTotalesPorMoneda(rows: CxpAgingRow[]): Record<string, CxpAgingTotals> {
  const map: Record<string, CxpAgingTotals> = {};
  for (const r of rows) {
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

/**
 * Monedas presentes en las filas (MXN/USD/EUR primero).
 * v13.462.0 — delega en el helper compartido `@/lib/aging/buckets`.
 */
export { monedasPresentes } from "@/lib/aging/buckets";
