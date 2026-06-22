/**
 * Scorecard de salud de un proveedor — wrapper de la RPC `proveedor_salud`.
 * Devuelve métricas de gasto, saldo, puntualidad de pagos, NC y embarques activos.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SaludProveedorMensual {
  mes: string; // YYYY-MM
  monto: number;
  facturas: number;
}

export interface SaludProveedor {
  facturas_12m: number;
  monto_12m: number;
  saldo_actual: number;
  dias_promedio_pago: number | null;
  pct_pagadas_a_tiempo: number | null;
  notas_credito_count: number;
  notas_credito_monto: number;
  embarques_activos: number;
  mensual: SaludProveedorMensual[];
}

export async function fetchProveedorSalud(proveedorId: string): Promise<SaludProveedor> {
  const { data, error } = await supabase.rpc("proveedor_salud", {
    p_proveedor_id: proveedorId,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC retorna jsonb tipado como `Json`; mapeamos al shape conocido.
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    facturas_12m: Number(raw.facturas_12m ?? 0),
    monto_12m: Number(raw.monto_12m ?? 0),
    saldo_actual: Number(raw.saldo_actual ?? 0),
    dias_promedio_pago: raw.dias_promedio_pago == null ? null : Number(raw.dias_promedio_pago),
    pct_pagadas_a_tiempo: raw.pct_pagadas_a_tiempo == null ? null : Number(raw.pct_pagadas_a_tiempo),
    notas_credito_count: Number(raw.notas_credito_count ?? 0),
    notas_credito_monto: Number(raw.notas_credito_monto ?? 0),
    embarques_activos: Number(raw.embarques_activos ?? 0),
    mensual: Array.isArray(raw.mensual)
      ? (raw.mensual as Array<Record<string, unknown>>).map((m) => ({
          mes: String(m.mes ?? ""),
          monto: Number(m.monto ?? 0),
          facturas: Number(m.facturas ?? 0),
        }))
      : [],
  };
}
