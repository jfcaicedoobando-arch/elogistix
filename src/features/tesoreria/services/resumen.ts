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

export type { ResumenCuenta, ResumenTesoreria,  TopItem } from "@/features/tesoreria/domain";

export async function fetchSaldosCuentas(organizationId?: string | null): Promise<ResumenCuenta[]> {
  let q = supabase
    .from("cuentas_bancarias")
    .select("id, alias, banco, moneda, saldo_inicial, organization_id").is("deleted_at", null)
    .eq("activa", true)
    .order("alias");
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data: cuentas, error } = await q;
  if (error) throw error;

  const ids = (cuentas ?? []).map((c) => c.id);
  // P4: una sola query a la vista agregada v_saldos_cuentas_bancarias en vez
  // de N full-scans client-side de bbva_movimientos por cuenta.
  const saldosMap = new Map<string, { abonos: number; cargos: number }>();
  if (ids.length > 0) {
    const { data: agg, error: errAgg } = await supabase
      .from("v_saldos_cuentas_bancarias")
      .select("cuenta_bancaria_id, total_abonos, total_cargos")
      .in("cuenta_bancaria_id", ids);
    if (errAgg) throw errAgg;
    for (const row of agg ?? []) {
      saldosMap.set(row.cuenta_bancaria_id as string, {
        abonos: Number(row.total_abonos ?? 0),
        cargos: Number(row.total_cargos ?? 0),
      });
    }
  }

  return (cuentas ?? []).map((c) => {
    const agg = saldosMap.get(c.id) ?? { abonos: 0, cargos: 0 };
    return {
      id: c.id,
      alias: c.alias,
      banco: c.banco,
      moneda: c.moneda,
      saldo: Number(c.saldo_inicial) + agg.abonos - agg.cargos,
    };
  });
}

/**
 * Compone resumen a partir de cuentas + cobranza/cxp. Permite inyectar
 * `cuentas` ya prefetched para evitar doble roundtrip cuando el caller
 * (agregador dashboard) ya las tiene.
 */
export async function fetchResumenTesoreria(args: {
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  organizationId?: string | null;
  tipoCambioUsd?: number;
  tipoCambioEur?: number;
  tipoCambioFecha?: string | null;
  cuentas?: ResumenCuenta[];
}): Promise<ResumenTesoreria> {
  const cuentas = args.cuentas ?? (await fetchSaldosCuentas(args.organizationId));
  return calcularResumenTesoreria({
    cuentas,
    cobranza: args.cobranza,
    cxp: args.cxp,
    tipoCambioUsd: args.tipoCambioUsd,
    tipoCambioEur: args.tipoCambioEur,
    tipoCambioFecha: args.tipoCambioFecha,
  });
}
