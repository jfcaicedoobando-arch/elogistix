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

/**
 * P2-5 (R5): la RPC emite `presupuestada_mxn` (femenino) en `por_concepto` de
 * ingresos y `presupuestado_mxn` en costos. El front lee un único nombre, por lo
 * que normalizamos aquí; antes el desglose de ingresos mostraba 0 y no cuadraba
 * con el KPI "Venta real · Presup." del encabezado.
 */
function normalizarConceptos(rows: unknown): PnlPorConcepto[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    const presup = row.presupuestado_mxn ?? row.presupuestada_mxn ?? 0;
    return {
      concepto: String(row.concepto ?? "(sin concepto)"),
      presupuestado_mxn: Number(presup) || 0,
      real_mxn: Number(row.real_mxn ?? 0) || 0,
      desviacion_mxn: (Number(row.real_mxn ?? 0) || 0) - (Number(presup) || 0),
    };
  });
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
    por_concepto: normalizarConceptos(raw.por_concepto),
    por_concepto_costo: normalizarConceptos(raw.por_concepto_costo),
    por_proveedor: Array.isArray(raw.por_proveedor) ? raw.por_proveedor : [],
  };
}
