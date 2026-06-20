/**
 * Servicio Tesorería — fuentes propias (cuentas + saldos calculados desde
 * movimientos BBVA). Ya NO importa `@/services/facturas` ni `@/services/cxp`
 * (Auditoría Paso 4, v12.95.11).
 *
 * El cálculo del resumen se hace con la función pura
 * `calcularResumenTesoreria` en `@/features/tesoreria/domain`, alimentada por el
 * hook `useResumenTesoreria` que compone las tres fuentes.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  calcularResumenTesoreria,
  type ResumenCuenta,
  type ResumenTesoreria,
  type CobranzaRow,
  type CxpRow,
} from "@/features/tesoreria/domain";

export type { ResumenCuenta, ResumenTesoreria, FlujoMes, TopItem } from "@/features/tesoreria/domain";

async function calcularSaldoCuenta(cuentaId: string, saldoInicial: number): Promise<number> {
  const { data, error } = await supabase
    .from("bbva_movimientos")
    .select("cargo, abono")
    .eq("cuenta_bancaria_id", cuentaId);
  if (error) throw error;
  let s = saldoInicial;
  for (const m of data ?? []) {
    s += Number(m.abono) - Number(m.cargo);
  }
  return s;
}

export async function fetchSaldosCuentas(): Promise<ResumenCuenta[]> {
  const { data: cuentas, error } = await supabase
    .from("cuentas_bancarias")
    .select("id, alias, banco, moneda, saldo_inicial")
    .eq("activa", true)
    .order("alias");
  if (error) throw error;

  const out: ResumenCuenta[] = [];
  for (const c of cuentas ?? []) {
    const saldo = await calcularSaldoCuenta(c.id, Number(c.saldo_inicial));
    out.push({ id: c.id, alias: c.alias, banco: c.banco, moneda: c.moneda, saldo });
  }
  return out;
}

/**
 * Compone resumen a partir de cuentas (fetched aquí) + cobranza/cxp (inyectados
 * por el caller). El hook `useResumenTesoreria` provee las dos últimas.
 */
export async function fetchResumenTesoreria(args: {
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
}): Promise<ResumenTesoreria> {
  const cuentas = await fetchSaldosCuentas();
  return calcularResumenTesoreria({ cuentas, cobranza: args.cobranza, cxp: args.cxp });
}
