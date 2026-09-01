/**
 * Helpers puros del resumen de tesorería (extraídos de `./resumen.ts` para
 * respetar el límite de 200 líneas · Power of 10).
 */
import type { CobranzaRow, CxpRow, FlujoMes, TasasCambio, TopItem } from "./resumen.types";
import { esCxcVencida } from "@/lib/domain/vencimiento";
import { aMxn } from "@/lib/financial/convertir";

/**
 * P1-7 — TC de `moneda`→MXN según el canon de tasas del agregador. `null`
 * para MXN (no aplica) o para monedas sin tasa configurada.
 */
export function tcDeMoneda(moneda: string, tasas: TasasCambio): number | undefined {
  const m = (moneda ?? "").toUpperCase();
  if (m === "USD") return tasas.usdMxn ?? undefined;
  if (m === "EUR") return tasas.eurMxn ?? undefined;
  return undefined;
}

export function calcularFlujo(
  cobranza: CobranzaRow[],
  cxp: CxpRow[],
  enVentana: (iso: string | null) => boolean,
  tasas: TasasCambio,
): FlujoMes {
  const flujo: FlujoMes = {
    por_cobrar_mxn: 0, por_cobrar_usd: 0, por_cobrar_eur: 0,
    por_pagar_mxn: 0, por_pagar_usd: 0, por_pagar_eur: 0,
    flujo_neto_mxn: 0, flujo_neto_usd: 0, flujo_neto_eur: 0,
    por_cobrar_total_mxn: 0, por_pagar_total_mxn: 0,
    flujo_incompleto: false,
  };
  let incompleto = false;
  for (const f of cobranza) {
    if (!enVentana(f.fecha_vencimiento) || f.saldo <= 0) continue;
    const moneda = (f.moneda ?? "MXN").toUpperCase();
    if (moneda === "USD") flujo.por_cobrar_usd += f.saldo;
    else if (moneda === "EUR") flujo.por_cobrar_eur += f.saldo;
    else flujo.por_cobrar_mxn += f.saldo;
    const conv = aMxn(f.saldo, moneda, tcDeMoneda(moneda, tasas));
    if (conv.completo) flujo.por_cobrar_total_mxn += conv.monto;
    else incompleto = true;
  }
  for (const f of cxp) {
    // Q-15.6 — mismo criterio de fecha efectiva que el flujo semanal y el
    // widget "Próximas a pagar": programada > vencimiento. Antes el KPI
    // "Por pagar 30d" miraba sólo el vencimiento y no cuadraba con el widget.
    const fechaEfectiva = f.fecha_programada_pago ?? f.fecha_vencimiento;
    if (!enVentana(fechaEfectiva) || f.saldo <= 0) continue;
    const moneda = (f.moneda ?? "MXN").toUpperCase();
    if (moneda === "USD") flujo.por_pagar_usd += f.saldo;
    else if (moneda === "EUR") flujo.por_pagar_eur += f.saldo;
    else flujo.por_pagar_mxn += f.saldo;
    const conv = aMxn(f.saldo, moneda, tcDeMoneda(moneda, tasas));
    if (conv.completo) flujo.por_pagar_total_mxn += conv.monto;
    else incompleto = true;
  }
  flujo.flujo_neto_mxn = flujo.por_cobrar_mxn - flujo.por_pagar_mxn;
  flujo.flujo_neto_usd = flujo.por_cobrar_usd - flujo.por_pagar_usd;
  flujo.flujo_neto_eur = flujo.por_cobrar_eur - flujo.por_pagar_eur;
  flujo.flujo_incompleto = incompleto;
  return flujo;
}

export function sumarVencidas<T extends { saldo: number; moneda: string }>(
  rows: T[],
  estatusOf: (r: T) => string | undefined,
  tasas: TasasCambio,
): { total_mxn: number; count: number } {
  let total_mxn = 0;
  let count = 0;
  for (const f of rows) {
    // Canon único de "vencida" + canon único de conversión (`aMxn`): antes esto
    // multiplicaba `saldo * tc` a mano y no marcaba los saldos sin TC confiable.
    if (!esCxcVencida({ saldo: f.saldo, estatus: estatusOf(f) })) continue;
    count += 1;
    const conv = aMxn(f.saldo, f.moneda, tcDeMoneda(f.moneda, tasas));
    if (conv.completo) total_mxn += conv.monto;
  }

  return { total_mxn, count };
}

interface TopAccessors<T> {
  filtro: (r: T) => boolean;
  nombre: (r: T) => string;
  moneda: (r: T) => string;
  saldo: (r: T) => number;
  dias: (r: T) => number | undefined;
}

/**
 * Agrupa filas por nombre+moneda antes de rankear (Top-5 por saldo).
 * `dias` conserva el peor caso (más días vencidos) del grupo.
 */
export function agruparTop<T>(rows: T[], acc: TopAccessors<T>): TopItem[] {
  const map = new Map<string, TopItem>();
  for (const r of rows) {
    if (!acc.filtro(r)) continue;
    const nombre = acc.nombre(r);
    const moneda = acc.moneda(r);
    const key = `${nombre}||${moneda}`;
    const dias = acc.dias(r);
    const prev = map.get(key);
    if (prev) {
      prev.saldo += acc.saldo(r);
      if (dias != null && (prev.dias == null || dias > prev.dias)) prev.dias = dias;
    } else {
      map.set(key, { nombre, saldo: acc.saldo(r), moneda, dias });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5);
}
