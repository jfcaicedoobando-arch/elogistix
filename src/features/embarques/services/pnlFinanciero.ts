/**
 * Wrapper de la RPC `pnl_financiero_embarque` que devuelve el P&L real
 * (Presupuestado vs. Real) de un embarque, en MXN.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PnlTotalesVenta {
  presupuestada_mxn: number;
  real_mxn: number;
  pdte_cobro_mxn: number;
}

export interface PnlTotalesCosto {
  presupuestado_mxn: number;
  real_mxn: number;
  pdte_pago_mxn: number;
}

export interface PnlPorConcepto {
  concepto: string;
  presupuestado_mxn: number;
  real_mxn: number;
  desviacion_mxn: number;
}

export interface PnlPorProveedor {
  proveedor_id: string | null;
  proveedor_nombre: string;
  presupuestado_mxn: number;
  real_mxn: number;
  facturas_count: number;
}

export interface PnlEmbarque {
  embarque_id: string;
  tipo_cambio_usd: number;
  tipo_cambio_eur: number;
  venta: PnlTotalesVenta;
  costo: PnlTotalesCosto;
  por_concepto: PnlPorConcepto[];
  por_concepto_costo: PnlPorConcepto[];
  por_proveedor: PnlPorProveedor[];
}

export async function fetchPnlEmbarque(embarqueId: string): Promise<PnlEmbarque> {
  const { data, error } = await supabase.rpc("pnl_financiero_embarque", {
    _embarque_id: embarqueId,
  });
  if (error) throw error;
  // SAFE-CAST: RPC `pnl_financiero_embarque` retorna JSON con el shape PnlEmbarque
  // garantizado por la función Postgres (ver migración pnl_financiero_embarque.sql).
  return data as unknown as PnlEmbarque;
}
