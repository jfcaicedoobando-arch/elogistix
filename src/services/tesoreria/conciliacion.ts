/**
 * Service de conciliación bancaria.
 * - importarMovimientos: upsert por (cuenta_id, hash_dedupe). Reporta nuevas vs duplicadas.
 * - listarMovimientos: filtrado por cuenta + estado.
 * - conciliarConPago / desconciliar: vincular un movimiento a pago_factura o pago_proveedor.
 * - ignorarMovimiento: marcar como Ignorado con motivo.
 * - sugerirCandidatos: matching por monto (±$1) y fecha (±5 días) contra CxC/CxP pendientes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { MovimientoParseado } from "@/lib/import/bbva";

export type MovimientoBBVA = Tables<"bbva_movimientos">;

export interface ImportarResultado {
  total: number;
  nuevos: number;
  duplicados: number;
}

export async function importarMovimientos(
  cuentaBancariaId: string,
  movimientos: MovimientoParseado[],
  userId: string | null,
): Promise<ImportarResultado> {
  if (movimientos.length === 0) return { total: 0, nuevos: 0, duplicados: 0 };
  const payload: TablesInsert<"bbva_movimientos">[] = movimientos.map((m) => ({
    cuenta_bancaria_id: cuentaBancariaId,
    fecha: m.fecha,
    concepto: m.concepto,
    referencia: m.referencia,
    cargo: m.cargo,
    abono: m.abono,
    saldo: m.saldo,
    hash_dedupe: m.hash_dedupe,
    importado_por: userId,
  }));
  // upsert: si ya existe por (cuenta_bancaria_id, hash_dedupe), ignora
  const { data, error } = await supabase
    .from("bbva_movimientos")
    .upsert(payload, {
      onConflict: "cuenta_bancaria_id,hash_dedupe",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw error;
  const nuevos = (data ?? []).length;
  return { total: movimientos.length, nuevos, duplicados: movimientos.length - nuevos };
}

export interface FiltrosMovimientos {
  cuenta_bancaria_id: string;
  estado?: "Pendiente" | "Conciliado" | "Ignorado" | "todos";
  desde?: string;
  hasta?: string;
}

export async function listarMovimientos(f: FiltrosMovimientos): Promise<MovimientoBBVA[]> {
  let q = supabase
    .from("bbva_movimientos")
    .select("*")
    .eq("cuenta_bancaria_id", f.cuenta_bancaria_id)
    .order("fecha", { ascending: false })
    .limit(2000);
  if (f.estado && f.estado !== "todos") q = q.eq("estado_conciliacion", f.estado);
  if (f.desde) q = q.gte("fecha", f.desde);
  if (f.hasta) q = q.lte("fecha", f.hasta);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MovimientoBBVA[];
}

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

const TOLERANCIA_MONTO = 1;
const TOLERANCIA_DIAS = 5;

export async function sugerirCandidatos(mov: MovimientoBBVA): Promise<Candidato[]> {
  const monto = Number(mov.cargo) > 0 ? Number(mov.cargo) : Number(mov.abono);
  if (monto <= 0) return [];
  const esCargo = Number(mov.cargo) > 0;

  const fecha = new Date(mov.fecha + "T00:00:00");
  const desde = new Date(fecha); desde.setDate(desde.getDate() - TOLERANCIA_DIAS);
  const hasta = new Date(fecha); hasta.setDate(hasta.getDate() + TOLERANCIA_DIAS);
  const desdeIso = desde.toISOString().slice(0, 10);
  const hastaIso = hasta.toISOString().slice(0, 10);
  const min = monto - TOLERANCIA_MONTO;
  const max = monto + TOLERANCIA_MONTO;

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
        delta_dias: Math.abs(Math.round((new Date(p.fecha_pago + "T00:00:00").getTime() - fecha.getTime()) / 86_400_000)),
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
        delta_dias: Math.abs(Math.round((new Date(p.fecha_pago + "T00:00:00").getTime() - fecha.getTime()) / 86_400_000)),
        delta_monto: Math.abs(Number(p.monto) - monto),
      });
    }
  }
  candidatos.sort((a, b) => (a.delta_monto - b.delta_monto) || (a.delta_dias - b.delta_dias));
  return candidatos;
}

export async function conciliarConPago(
  movId: string,
  tipo: "cxc" | "cxp",
  pagoId: string,
  userId: string | null,
) {
  const patch = tipo === "cxc"
    ? { pago_factura_id: pagoId, pago_proveedor_id: null }
    : { pago_proveedor_id: pagoId, pago_factura_id: null };
  const { error } = await supabase
    .from("bbva_movimientos")
    .update({
      ...patch,
      estado_conciliacion: "Conciliado",
      conciliado_por: userId,
      conciliado_at: new Date().toISOString(),
    })
    .eq("id", movId);
  if (error) throw error;
}

export async function desconciliarMovimiento(movId: string) {
  const { error } = await supabase
    .from("bbva_movimientos")
    .update({
      pago_factura_id: null,
      pago_proveedor_id: null,
      estado_conciliacion: "Pendiente",
      conciliado_por: null,
      conciliado_at: null,
    })
    .eq("id", movId);
  if (error) throw error;
}

export async function ignorarMovimiento(movId: string, motivo: string) {
  const { error } = await supabase
    .from("bbva_movimientos")
    .update({ estado_conciliacion: "Ignorado", motivo_ignorar: motivo })
    .eq("id", movId);
  if (error) throw error;
}
