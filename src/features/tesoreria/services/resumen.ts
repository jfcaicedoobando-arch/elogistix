/**
 * Servicio Tesorería — fuentes propias (cuentas + saldos calculados desde
 * movimientos BBVA). Ya NO importa `@/services/facturas` ni `@/services/cxp`
 * (Auditoría Paso 4, v12.95.11).
 *
 * v13.300.36 — Se acepta `organizationId` para filtrar cuentas por tenant
 * (auditoría Profit, Batch G). Además `fetchSaldosCuentas` paraleliza el
 * cálculo de saldos con `Promise.all` en lugar de un loop secuencial.
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

export async function fetchSaldosCuentas(organizationId?: string | null): Promise<ResumenCuenta[]> {
  let q = supabase
    .from("cuentas_bancarias")
    .select("id, alias, banco, moneda, saldo_inicial, organization_id")
    .eq("activa", true)
    .order("alias");
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data: cuentas, error } = await q;
  if (error) throw error;

  // Paraleliza el cálculo de saldos: antes era secuencial (N RTTs).
  const saldos = await Promise.all(
    (cuentas ?? []).map((c) => calcularSaldoCuenta(c.id, Number(c.saldo_inicial))),
  );
  return (cuentas ?? []).map((c, i) => ({
    id: c.id,
    alias: c.alias,
    banco: c.banco,
    moneda: c.moneda,
    saldo: saldos[i],
  }));
}

/**
 * Compone resumen a partir de cuentas (fetched aquí) + cobranza/cxp (inyectados
 * por el caller). El hook `useResumenTesoreria` provee las dos últimas.
 */
export async function fetchResumenTesoreria(args: {
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  organizationId?: string | null;
}): Promise<ResumenTesoreria> {
  const cuentas = await fetchSaldosCuentas(args.organizationId);
  return calcularResumenTesoreria({ cuentas, cobranza: args.cobranza, cxp: args.cxp });
}
