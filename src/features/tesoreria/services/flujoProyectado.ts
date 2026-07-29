/**
 * Servicio Tesorería — flujo proyectado. Solo carga fuentes propias
 * (liquidaciones de comisión). Cobranza/CxP/cuentas se inyectan por el
 * caller (hook `useFlujoProyectado`). Auditoría Paso 4, v12.95.11.
 *
 * v13.300.36 — filtra `liquidaciones_comision` por `organization_id`.
 * Nota: `liquidaciones_comision` no tiene columna `deleted_at`; el
 * filtro funcional equivalente es `fecha_pago IS NULL` (pendientes).
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
  
  SemanaFlujo,
  FlujoProyectado,
} from "@/features/tesoreria/domain";

export async function fetchLiquidacionesPendientes(
  organizationId?: string | null,
): Promise<LiquidacionRow[]> {
  let q = supabase
    .from("liquidaciones_comision")
    .select("id, vendedora_id, periodo, total_mxn, fecha_pago, created_at")
    .is("fecha_pago", null)
    .limit(500);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LiquidacionRow[];
}

export async function fetchFlujoProyectado(args: {
  cuentas: ResumenCuenta[];
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  dias?: number;
  organizationId?: string | null;
  tipoCambioUsd?: number;
  tipoCambioFecha?: string | null;
}): Promise<FlujoProyectado> {
  const liquidaciones = await fetchLiquidacionesPendientes(args.organizationId);
  return calcularFlujoProyectado({
    cuentas: args.cuentas,
    cobranza: args.cobranza,
    cxp: args.cxp,
    liquidaciones,
    dias: args.dias ?? 90,
    tipoCambioUsd: args.tipoCambioUsd,
    tipoCambioFecha: args.tipoCambioFecha,
  });
}
