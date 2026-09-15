/**
 * Matching de candidatos para conciliación bancaria.
 * Tolerancia: monto ±$1, fecha ±5 días contra CxC/CxP pendientes.
 *
 * Ola 5 · M8 — el sugeridor NUNCA cruza monedas: los movimientos no traen
 * moneda propia (la hereda de la cuenta bancaria), así que se resuelve la
 * moneda de la cuenta y sólo se ofrecen pagos en esa misma moneda. Antes un
 * pago de 1,000 USD podía sugerirse para un cargo de 1,000 MXN.
 */
import { supabase } from "@/integrations/supabase/client";
import type { MovimientoBBVA } from "./conciliacion";
import { TOLERANCIA_MONTO_MXN, TOLERANCIA_DIAS, rangoFechasIso, deltaDiasIso } from "../domain/tolerancia";
import type { Moneda } from "@/types/db";
import { CAP_LISTA } from "@/constants/queryCaps";

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

/** Monedas soportadas por el enum `moneda` de la base (alias central). */
export type MonedaSoportada = Moneda;

/**
 * Moneda de la cuenta bancaria del movimiento.
 * EC-04 — si la lectura falla ya NO se asume "MXN": eso permitía auto-conciliar
 * un movimiento en USD contra un pago en pesos por el mismo número.
 *
 * FIN-NEW-03 — tampoco se asume MXN cuando el movimiento no trae cuenta o la
 * cuenta no existe/no tiene una moneda del enum: devuelve `null` ("moneda
 * desconocida") y el sugeridor falla cerrado en vez de proponer pagos en pesos
 * por coincidencia nominal.
 */
export async function monedaDeCuenta(
  cuentaBancariaId: string | null,
): Promise<MonedaSoportada | null> {
  if (!cuentaBancariaId) return null;
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .select("moneda")
    .eq("id", cuentaBancariaId)
    .maybeSingle();
  if (error) throw error;
  return monedaConocida(data?.moneda);
}

/** Moneda del enum `moneda`, o `null` si no es reconocible. */
function monedaConocida(v: unknown): MonedaSoportada | null {
  const m = String(v ?? "").toUpperCase();
  return m === "MXN" || m === "USD" || m === "EUR" ? (m as MonedaSoportada) : null;
}

/**
 * N15 (Ola 4): pagos que YA están ligados a un movimiento bancario vivo.
 * Sin este filtro, dos movimientos del mismo monto recibían el mismo "match
 * único" y la auto-conciliación masiva intentaba ligar ambos al mismo pago.
 * La unicidad real la garantiza el índice uq_bbva_movimientos_pago_*; esto
 * evita ofrecer candidatos imposibles (y toasts de error en la auto-masiva).
 */
async function pagosYaVinculados(pagoIds: string[], tipo: "cxc" | "cxp"): Promise<Set<string>> {
  if (pagoIds.length === 0) return new Set();
  const columna = tipo === "cxc" ? "pago_factura_id" : "pago_proveedor_id";
  const { data } = await supabase
    .from("bbva_movimientos")
    .select("pago_factura_id, pago_proveedor_id")
    .in(columna, pagoIds)
    .is("deleted_at", null)
    .limit(CAP_LISTA);
  const set = new Set<string>();
  // SAFE-CAST: supabase-js tipa ambas columnas como string | null.
  for (const row of (data ?? []) as Array<Record<string, string | null>>) {
    const id = row[columna];
    if (id) set.add(id);
  }
  return set;
}
interface Ventana {
  desdeIso: string;
  hastaIso: string;
  min: number;
  max: number;
  moneda: MonedaSoportada;
  monto: number;
  fechaMov: string;
}

/** Cargo bancario → pago a proveedor (egreso). */
async function candidatosCxp(v: Ventana): Promise<Candidato[]> {
  const { data } = await supabase
    .from("pagos_proveedor")
    .select("id, fecha_pago, monto, moneda, referencia, proveedor_facturas(proveedor_nombre)")
    .gte("fecha_pago", v.desdeIso)
    .lte("fecha_pago", v.hastaIso)
    .gte("monto", v.min)
    .lte("monto", v.max)
    .eq("moneda", v.moneda)
    .is("deleted_at", null)
    .limit(20);
  // N15 (Ola 4): no ofrecer pagos ya conciliados con otro movimiento vivo.
  const vinculados = await pagosYaVinculados((data ?? []).map((p) => p.id), "cxp");
  const out: Candidato[] = [];
  for (const p of data ?? []) {
    if (vinculados.has(p.id)) continue;
    const pf = (p as { proveedor_facturas?: { proveedor_nombre?: string } | null }).proveedor_facturas;
    out.push({
      tipo: "cxp",
      pago_id: p.id,
      fecha: p.fecha_pago,
      referencia: p.referencia ?? "",
      monto: Number(p.monto),
      moneda: p.moneda,
      contraparte: pf?.proveedor_nombre ?? "—",
      delta_dias: deltaDiasIso(p.fecha_pago, v.fechaMov),
      delta_monto: Math.abs(Number(p.monto) - v.monto),
    });
  }
  return out;
}

/** Abono bancario → pago de cliente (ingreso). */
async function candidatosCxc(v: Ventana): Promise<Candidato[]> {
  const { data } = await supabase
    .from("pagos_factura")
    .select("id, fecha_pago, monto, moneda, referencia, facturas(cliente_nombre)")
    .gte("fecha_pago", v.desdeIso)
    .lte("fecha_pago", v.hastaIso)
    .gte("monto", v.min)
    .lte("monto", v.max)
    .eq("moneda", v.moneda)
    .is("deleted_at", null)
    .limit(20);
  // N15 (Ola 4): no ofrecer pagos ya conciliados con otro movimiento vivo.
  const vinculados = await pagosYaVinculados((data ?? []).map((p) => p.id), "cxc");
  const out: Candidato[] = [];
  for (const p of data ?? []) {
    if (vinculados.has(p.id)) continue;
    const fac = (p as { facturas?: { cliente_nombre?: string } | null }).facturas;
    out.push({
      tipo: "cxc",
      pago_id: p.id,
      fecha: p.fecha_pago,
      referencia: p.referencia ?? "",
      monto: Number(p.monto),
      moneda: p.moneda,
      contraparte: fac?.cliente_nombre ?? "—",
      delta_dias: deltaDiasIso(p.fecha_pago, v.fechaMov),
      delta_monto: Math.abs(Number(p.monto) - v.monto),
    });
  }
  return out;
}

export async function sugerirCandidatos(
  mov: MovimientoBBVA,
  monedaCuenta?: string,
): Promise<Candidato[]> {
  const cargo = Number(mov.cargo);
  const monto = cargo > 0 ? cargo : Number(mov.abono);
  if (monto <= 0) return [];
  // FIN-NEW-03: sin moneda confirmada no hay sugerencias (fail-closed).
  const moneda: MonedaSoportada | null = monedaCuenta
    ? monedaConocida(monedaCuenta)
    : await monedaDeCuenta(mov.cuenta_bancaria_id);
  if (!moneda) return [];


  const { desde: desdeIso, hasta: hastaIso } = rangoFechasIso(mov.fecha, TOLERANCIA_DIAS);
  const ventana: Ventana = {
    desdeIso,
    hastaIso,
    min: monto - TOLERANCIA_MONTO_MXN,
    max: monto + TOLERANCIA_MONTO_MXN,
    moneda,
    monto,
    fechaMov: mov.fecha,
  };

  const candidatos = cargo > 0 ? await candidatosCxp(ventana) : await candidatosCxc(ventana);
  candidatos.sort((a, b) => (a.delta_monto - b.delta_monto) || (a.delta_dias - b.delta_dias));
  return candidatos;
}
