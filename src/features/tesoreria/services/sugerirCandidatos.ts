/**
 * Matching de candidatos para conciliación bancaria.
 * Tolerancia: monto ±$1, fecha ±5 días contra CxC/CxP pendientes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { MovimientoBBVA } from "./conciliacion";
import { TOLERANCIA_MONTO_MXN, TOLERANCIA_DIAS, rangoFechasIso, deltaDiasIso } from "../domain/tolerancia";

export interface Candidato {
  tipo: "cxc" | "cxp";
  pago_id: string;
  fecha: string;
  referencia: string;
  monto: number;
  moneda: string;
  contraparte: string; // cliente o proveedor
  delta_dias: number;
  delta_monto: number;
}

export async function sugerirCandidatos(mov: MovimientoBBVA): Promise<Candidato[]> {
  const monto = Number(mov.cargo) > 0 ? Number(mov.cargo) : Number(mov.abono);
  if (monto <= 0) return [];
  const esCargo = Number(mov.cargo) > 0;

  const { desde: desdeIso, hasta: hastaIso } = rangoFechasIso(mov.fecha, TOLERANCIA_DIAS);
  const min = monto - TOLERANCIA_MONTO_MXN;
  const max = monto + TOLERANCIA_MONTO_MXN;

  const candidatos: Candidato[] = [];

  // Cargo bancario → pago a proveedor (egreso)
  if (esCargo) {
    const { data } = await supabase
      .from("pagos_proveedor")
      .select("id, fecha_pago, monto, moneda, referencia, proveedor_facturas(proveedor_nombre)")
      .gte("fecha_pago", desdeIso)
      .lte("fecha_pago", hastaIso)
      .gte("monto", min)
      .lte("monto", max)
      .is("deleted_at", null)
      .limit(20);
    for (const p of data ?? []) {
      const pf = (p as { proveedor_facturas?: { proveedor_nombre?: string } | null }).proveedor_facturas;
      candidatos.push({
        tipo: "cxp",
        pago_id: p.id,
        fecha: p.fecha_pago,
        referencia: p.referencia,
        monto: Number(p.monto),
        moneda: p.moneda,
        contraparte: pf?.proveedor_nombre ?? "—",
        delta_dias: deltaDiasIso(p.fecha_pago, mov.fecha),
        delta_monto: Math.abs(Number(p.monto) - monto),
      });
    }
  } else {
    // Abono bancario → pago de cliente (ingreso)
    const { data } = await supabase
      .from("pagos_factura")
      .select("id, fecha_pago, monto, moneda, referencia, facturas(cliente_nombre)")
      .gte("fecha_pago", desdeIso)
      .lte("fecha_pago", hastaIso)
      .gte("monto", min)
      .lte("monto", max)
      .is("deleted_at", null)
      .limit(20);
    for (const p of data ?? []) {
      const f = (p as { facturas?: { cliente_nombre?: string } | null }).facturas;
      candidatos.push({
        tipo: "cxc",
        pago_id: p.id,
        fecha: p.fecha_pago,
        referencia: p.referencia ?? "",
        monto: Number(p.monto),
        moneda: p.moneda,
        contraparte: f?.cliente_nombre ?? "—",
        delta_dias: deltaDiasIso(p.fecha_pago, mov.fecha),
        delta_monto: Math.abs(Number(p.monto) - monto),
      });
    }
  }
  candidatos.sort((a, b) => (a.delta_monto - b.delta_monto) || (a.delta_dias - b.delta_dias));
  return candidatos;
}
