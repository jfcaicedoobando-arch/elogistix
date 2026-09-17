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
import { TOLERANCIA_MONTO_MXN, TOLERANCIA_DIAS, rangoFechasIso } from "../domain/tolerancia";
import {
  candidatosCxc, candidatosCxp, LIMITE_SUGERENCIAS, type Ventana,
} from "./sugerirCandidatos.consultas";
import type {
  Candidato, MonedaSoportada, SugerenciasResultado,
} from "./sugerirCandidatos.tipos";

export type { Candidato, MonedaSoportada, SugerenciasResultado };
export { LIMITE_SUGERENCIAS };

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
 * Sugerencias con metadatos. La auto-conciliación usa esta variante porque
 * necesita saber si la lista quedó recortada (ambigüedad no comprobada).
 */
export async function sugerirCandidatosDetalle(
  mov: MovimientoBBVA,
  monedaCuenta?: string,
): Promise<SugerenciasResultado> {
  const cargo = Number(mov.cargo);
  const monto = cargo > 0 ? cargo : Number(mov.abono);
  if (monto <= 0) return { candidatos: [], truncado: false };
  // FIN-NEW-03: sin moneda confirmada no hay sugerencias (fail-closed).
  const moneda: MonedaSoportada | null = monedaCuenta
    ? monedaConocida(monedaCuenta)
    : await monedaDeCuenta(mov.cuenta_bancaria_id);
  if (!moneda) return { candidatos: [], truncado: false };

  const { desde: desdeIso, hasta: hastaIso } = rangoFechasIso(mov.fecha, TOLERANCIA_DIAS);
  // MNY P1.2: la ventana de importe usa la tolerancia de la moneda de la cuenta.
  const tol = toleranciaMonto(moneda);
  const ventana: Ventana = {
    desdeIso,
    hastaIso,
    min: monto - tol,
    max: monto + tol,
    moneda,
    monto,
    fechaMov: mov.fecha,
  };

  const { candidatos, truncado } =
    cargo > 0 ? await candidatosCxp(ventana) : await candidatosCxc(ventana);
  candidatos.sort((a, b) => (a.delta_monto - b.delta_monto) || (a.delta_dias - b.delta_dias));
  return { candidatos: candidatos.slice(0, LIMITE_SUGERENCIAS), truncado };
}

export async function sugerirCandidatos(
  mov: MovimientoBBVA,
  monedaCuenta?: string,
): Promise<Candidato[]> {
  const { candidatos } = await sugerirCandidatosDetalle(mov, monedaCuenta);
  return candidatos;
}
