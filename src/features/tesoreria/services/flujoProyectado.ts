/**
 * Servicio Tesorería — flujo proyectado. Solo carga fuentes propias
 * (liquidaciones de comisión). Cobranza/CxP/cuentas se inyectan por el
 * caller (hook `useFlujoProyectado`). Auditoría Paso 4, v12.95.11.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  calcularFlujoProyectado,
  type CobranzaRow,
  type CxpRow,
  type FlujoProyectado,
  type LiquidacionRow,
  type ResumenCuenta,
} from "@/features/tesoreria/domain";

export type {
  DetalleFlujo,
  SemanaFlujo,
  FlujoProyectado,
} from "@/features/tesoreria/domain";

export async function fetchLiquidacionesPendientes(): Promise<LiquidacionRow[]> {
  const { data, error } = await supabase
    .from("liquidaciones_comision")
    .select("id, vendedora_id, periodo, total_mxn, fecha_pago, created_at")
    .is("fecha_pago", null)
    .limit(500);
  if (error) throw error;
  return (data ?? []) as LiquidacionRow[];
}

export async function fetchFlujoProyectado(args: {
  cuentas: ResumenCuenta[];
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  dias?: number;
}): Promise<FlujoProyectado> {
  const liquidaciones = await fetchLiquidacionesPendientes();
  return calcularFlujoProyectado({
    cuentas: args.cuentas,
    cobranza: args.cobranza,
    cxp: args.cxp,
    liquidaciones,
    dias: args.dias ?? 90,
  });
}
