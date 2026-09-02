/**
 * Defecto 7 — El saldo de una factura del portal NO puede calcularse desde la
 * lista de pagos/NC (topada en `PORTAL_RELATED_MAX`). Este servicio pide el
 * agregado completo a la RPC `portal_factura_resumen_saldo`, que suma en la
 * base de datos y devuelve el saldo canónico (`saldo_factura`).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ResumenSaldoFacturaPortal {
  total: number;
  pagado: number;
  notasCredito: number;
  saldo: number;
  numPagos: number;
  numNotas: number;
  liquidada: boolean;
}

export async function fetchResumenSaldoFacturaPortal(
  facturaId: string,
): Promise<ResumenSaldoFacturaPortal | null> {
  const { data, error } = await supabase.rpc("portal_factura_resumen_saldo", {
    p_factura_id: facturaId,
  });
  if (error) throw error;
  const fila = Array.isArray(data) ? data[0] : null;
  if (!fila) return null;
  const saldo = Number(fila.saldo ?? 0);
  return {
    total: Number(fila.total ?? 0),
    pagado: Number(fila.pagado ?? 0),
    notasCredito: Number(fila.notas_credito ?? 0),
    saldo,
    numPagos: Number(fila.num_pagos ?? 0),
    numNotas: Number(fila.num_notas ?? 0),
    // Misma tolerancia canónica que los triggers de saldo (0.005).
    liquidada: saldo <= 0.005,
  };
}
