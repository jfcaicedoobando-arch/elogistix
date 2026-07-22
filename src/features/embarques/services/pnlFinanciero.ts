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
  // 13.308.6: defaults defensivos — la RPC puede devolver null en arrays cuando el
  // embarque no tiene conceptos/proveedores. Sentry JAVASCRIPT-REACT-3C.
  const raw = (data ?? {}) as Partial<PnlEmbarque>;
  return {
    embarque_id: raw.embarque_id ?? embarqueId,
    tipo_cambio_usd: raw.tipo_cambio_usd ?? 0,
    tipo_cambio_eur: raw.tipo_cambio_eur ?? 0,
    venta: raw.venta ?? { presupuestada_mxn: 0, real_mxn: 0, pdte_cobro_mxn: 0 },
    costo: raw.costo ?? { presupuestado_mxn: 0, real_mxn: 0, pdte_pago_mxn: 0 },
    por_concepto: Array.isArray(raw.por_concepto) ? raw.por_concepto : [],
    por_concepto_costo: Array.isArray(raw.por_concepto_costo) ? raw.por_concepto_costo : [],
    por_proveedor: Array.isArray(raw.por_proveedor) ? raw.por_proveedor : [],
  };
}
