/**
 * Consultas de candidatos para conciliación bancaria (CxC/CxP) y filtro de
 * pagos ya vinculados. Extraído de `sugerirCandidatos.ts` para mantener los
 * archivos productivos por debajo de 200 líneas (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import { deltaDiasIso } from "../domain/tolerancia";
import { CAP_LISTA } from "@/constants/queryCaps";
import type { Candidato, MonedaSoportada, SugerenciasResultado } from "./sugerirCandidatos.tipos";
import { acumularCandidatos } from "./sugerirCandidatos.paginado";

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

/** Tamaño de página: uno más que el tope para detectar overflow. */
const TAM_PAGINA = LIMITE_SUGERENCIAS + 1;

/** Cargo bancario → pago a proveedor (egreso). */
export async function candidatosCxp(v: Ventana): Promise<SugerenciasResultado> {
  return acumularCandidatos(
    TAM_PAGINA,
    (desde, hasta) =>
      supabase
        .from("pagos_proveedor")
        .select("id, fecha_pago, monto, moneda, referencia, lote_id, proveedor_facturas(proveedor_nombre)")
        .gte("fecha_pago", v.desdeIso)
        .lte("fecha_pago", v.hastaIso)
        .gte("monto", v.min)
        .lte("monto", v.max)
        .eq("moneda", v.moneda)
        .is("deleted_at", null)
        .order("fecha_pago", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta),
    (filas) => candidatosCxpDePagina(filas, v),
  );
}

interface FilaCxp {
  id: string;
  fecha_pago: string;
  monto: number | string;
  moneda: string;
  referencia: string | null;
  lote_id?: string | null;
  proveedor_facturas?: { proveedor_nombre?: string } | null;
}

/** Descarta pagos ya conciliados (individuales y miembros de un lote vivo). */
async function candidatosCxpDePagina(filas: FilaCxp[], v: Ventana): Promise<Candidato[]> {
  if (filas.length === 0) return [];
  const vinculados = await pagosYaVinculados(filas.map((p) => p.id), "cxp");
  const loteIds = Array.from(
    new Set(filas.map((p) => p.lote_id).filter((id): id is string => Boolean(id))),
  );
  const lotesVivos = await lotesYaVinculados(loteIds);
  const out: Candidato[] = [];
  for (const p of filas) {
    if (vinculados.has(p.id)) continue;
    if (p.lote_id && lotesVivos.has(p.lote_id)) continue;
    out.push({
      tipo: "cxp",
      pago_id: p.id,
      fecha: p.fecha_pago,
      referencia: p.referencia ?? "",
      monto: Number(p.monto),
      moneda: p.moneda,
      contraparte: p.proveedor_facturas?.proveedor_nombre ?? "—",
      delta_dias: deltaDiasIso(p.fecha_pago, v.fechaMov),
      delta_monto: Math.abs(Number(p.monto) - v.monto),
    });
  }
  return out;
}

interface FilaCxc {
  id: string;
  fecha_pago: string;
  monto: number | string;
  moneda: string;
  referencia: string | null;
  facturas?: { cliente_nombre?: string } | null;
}

/** Abono bancario → pago de cliente (ingreso). */
export async function candidatosCxc(v: Ventana): Promise<SugerenciasResultado> {
  return acumularCandidatos(
    TAM_PAGINA,
    (desde, hasta) =>
      supabase
        .from("pagos_factura")
        .select("id, fecha_pago, monto, moneda, referencia, facturas(cliente_nombre)")
        .gte("fecha_pago", v.desdeIso)
        .lte("fecha_pago", v.hastaIso)
        .gte("monto", v.min)
        .lte("monto", v.max)
        .eq("moneda", v.moneda)
        .is("deleted_at", null)
        .order("fecha_pago", { ascending: true })
        .order("id", { ascending: true })
        .range(desde, hasta),
    (filas) => candidatosCxcDePagina(filas, v),
  );
}

async function candidatosCxcDePagina(filas: FilaCxc[], v: Ventana): Promise<Candidato[]> {
  if (filas.length === 0) return [];
  const vinculados = await pagosYaVinculados(filas.map((p) => p.id), "cxc");
  const out: Candidato[] = [];
  for (const p of filas) {
    if (vinculados.has(p.id)) continue;
    out.push({
      tipo: "cxc",
      pago_id: p.id,
      fecha: p.fecha_pago,
      referencia: p.referencia ?? "",
      monto: Number(p.monto),
      moneda: p.moneda,
      contraparte: p.facturas?.cliente_nombre ?? "—",
      delta_dias: deltaDiasIso(p.fecha_pago, v.fechaMov),
      delta_monto: Math.abs(Number(p.monto) - v.monto),
    });
  }
  return out;
}
