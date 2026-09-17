/**
 * Consultas de candidatos para conciliación bancaria (CxC/CxP) y filtro de
 * pagos ya vinculados. Extraído de `sugerirCandidatos.ts` para mantener los
 * archivos productivos por debajo de 200 líneas (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import { deltaDiasIso } from "../domain/tolerancia";
import { CAP_LISTA } from "@/constants/queryCaps";
import type { Candidato, MonedaSoportada, SugerenciasResultado } from "./sugerirCandidatos.tipos";

export interface Ventana {
  desdeIso: string;
  hastaIso: string;
  min: number;
  max: number;
  moneda: MonedaSoportada;
  monto: number;
  fechaMov: string;
}

/**
 * Tope de candidatos que se muestran. Se consulta uno más (`+ 1`) para poder
 * distinguir "hay exactamente 20" de "hay más de 20": con overflow no se puede
 * afirmar que un match sea único y la auto-conciliación debe abstenerse.
 */
export const LIMITE_SUGERENCIAS = 20;

/**
 * N15 (Ola 4): pagos que YA están ligados a un movimiento bancario vivo.
 * Sin este filtro, dos movimientos del mismo monto recibían el mismo "match
 * único" y la auto-conciliación masiva intentaba ligar ambos al mismo pago.
 */
async function pagosYaVinculados(pagoIds: string[], tipo: "cxc" | "cxp"): Promise<Set<string>> {
  if (pagoIds.length === 0) return new Set();
  const columna = tipo === "cxc" ? "pago_factura_id" : "pago_proveedor_id";
  const { data, error } = await supabase
    .from("bbva_movimientos")
    .select("pago_factura_id, pago_proveedor_id")
    .in(columna, pagoIds)
    .is("deleted_at", null)
    .limit(CAP_LISTA);
  // MNY: sin esta lectura no se sabe qué pagos ya están ligados; devolver un
  // set vacío ofrecería candidatos imposibles. Se propaga el error.
  if (error) throw error;
  const set = new Set<string>();
  // SAFE-CAST: supabase-js tipa ambas columnas como string | null.
  for (const row of (data ?? []) as Array<Record<string, string | null>>) {
    const id = row[columna];
    if (id) set.add(id);
  }
  return set;
}

/**
 * MNY: un pago que forma parte de un lote CxP ya está representado por el
 * movimiento bancario del lote (`pago_proveedor_lote_id`). Sugerirlo como pago
 * individual permitiría que el mismo egreso quedara conciliado dos veces.
 */
async function lotesYaVinculados(loteIds: string[]): Promise<Set<string>> {
  if (loteIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("bbva_movimientos")
    .select("pago_proveedor_lote_id")
    .in("pago_proveedor_lote_id", loteIds)
    .is("deleted_at", null)
    .limit(CAP_LISTA);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<{ pago_proveedor_lote_id: string | null }>) {
    if (row.pago_proveedor_lote_id) set.add(row.pago_proveedor_lote_id);
  }
  return set;
}

/** Cargo bancario → pago a proveedor (egreso). */
export async function candidatosCxp(v: Ventana): Promise<SugerenciasResultado> {
  const { data, error } = await supabase
    .from("pagos_proveedor")
    .select("id, fecha_pago, monto, moneda, referencia, lote_id, proveedor_facturas(proveedor_nombre)")
    .gte("fecha_pago", v.desdeIso)
    .lte("fecha_pago", v.hastaIso)
    .gte("monto", v.min)
    .lte("monto", v.max)
    .eq("moneda", v.moneda)
    .is("deleted_at", null)
    .limit(LIMITE_SUGERENCIAS + 1);
  // MNY: un error de lectura NO puede verse como "sin coincidencias".
  if (error) throw error;
  const filas = data ?? [];
  const truncado = filas.length > LIMITE_SUGERENCIAS;
  const vinculados = await pagosYaVinculados(filas.map((p) => p.id), "cxp");
  const loteIds = Array.from(
    new Set(
      (filas as Array<{ lote_id?: string | null }>)
        .map((p) => p.lote_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const lotesVivos = await lotesYaVinculados(loteIds);
  const out: Candidato[] = [];
  for (const p of filas) {
    if (vinculados.has(p.id)) continue;
    const loteDelPago = (p as { lote_id?: string | null }).lote_id;
    if (loteDelPago && lotesVivos.has(loteDelPago)) continue;
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
  return { candidatos: out, truncado };
}

/** Abono bancario → pago de cliente (ingreso). */
export async function candidatosCxc(v: Ventana): Promise<SugerenciasResultado> {
  const { data, error } = await supabase
    .from("pagos_factura")
    .select("id, fecha_pago, monto, moneda, referencia, facturas(cliente_nombre)")
    .gte("fecha_pago", v.desdeIso)
    .lte("fecha_pago", v.hastaIso)
    .gte("monto", v.min)
    .lte("monto", v.max)
    .eq("moneda", v.moneda)
    .is("deleted_at", null)
    .limit(LIMITE_SUGERENCIAS + 1);
  if (error) throw error;
  const filas = data ?? [];
  const truncado = filas.length > LIMITE_SUGERENCIAS;
  const vinculados = await pagosYaVinculados(filas.map((p) => p.id), "cxc");
  const out: Candidato[] = [];
  for (const p of filas) {
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
  return { candidatos: out, truncado };
}
