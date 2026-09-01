/**
 * Lógica pura: flujo de caja proyectado por semana ISO a N días.
 * Ver `./resumen.ts` para contexto del refactor (Auditoría Paso 4).
 * Aplicadores extraídos a `./flujoProyectado.aplicadores.ts`.
 */
import { parseDateOnlyLocal, formatDateOnlyLocal } from "@/lib/date/dateOnly";
import { aMxn } from "@/lib/financial/convertir";
import type { CobranzaRow, CxpRow, LiquidacionRow, ResumenCuenta, TasasCambio } from "./resumen";
import { sumarSaldosCuentas } from "./resumen";
import { tcDeMoneda } from "./resumenHelpers";
import { Exclusiones, aplicarCobranza, aplicarCxp, aplicarLiquidaciones } from "./flujoProyectado.aplicadores";

export interface DetalleFlujo {
  id: string;
  concepto: string;
  monto_mxn: number;
  fecha_vencimiento: string;
  moneda: string;
}

export interface SemanaFlujo {
  semana_iso: string;
  inicio: string;
  fin: string;
  entradas_mxn: number;
  salidas_mxn: number;
  flujo_neto_mxn: number;
  saldo_proyectado_mxn: number;
  detalle_entradas: DetalleFlujo[];
  detalle_salidas: DetalleFlujo[];
}

export interface FlujoProyectado {
  saldo_inicial_mxn: number;
  semanas: SemanaFlujo[];
  total_entradas_mxn: number;
  total_salidas_mxn: number;
  saldo_final_mxn: number;
  alertas_negativas: number;
  /** Q-06: `true` si algún monto en divisa extranjera (saldo inicial, entradas
   *  o salidas) no pudo convertirse a MXN por falta de TC confiable y quedó
   *  fuera de los totales. */
  saldo_incompleto: boolean;
  /** Q-06: montos nominales (sin convertir) excluidos, agrupados por moneda. */
  excluido_por_moneda: Record<string, number>;
  /** Q-06: TC USD→MXN vigente usado para convertir (si lo hubo). */
  tipo_cambio_usd?: number | null;
  /** P1-7: TC EUR→MXN vigente usado para convertir (si lo hubo). */
  tipo_cambio_eur?: number | null;
  /** Q-06: fecha (YYYY-MM-DD) del TC DOF aplicado. */
  tipo_cambio_fecha?: string | null;
}

export function inicioSemana(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dia = x.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  x.setDate(x.getDate() + diff);
  return x;
}

export function isoWeekKey(d: Date): string {
  // Q-15.1 — todas las fechas del flujo son "date-only" ancladas a medianoche
  // LOCAL (`parseDateOnlyLocal` / `new Date(y, m, d)`). Leerlas con getUTC*
  // corría la semana un día atrás en zonas UTC+ (off-by-one). Se usan los
  // componentes locales y se hace la aritmética ISO en UTC sobre esa base.
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * FIX C6: convierte a MXN con el canon único. Sin TC confiable el monto NO se
 * suma (antes se devolvía el monto nativo, sumando USD como si fueran MXN).
 */
export function toMxn(monto: number, moneda: string, tc: number | undefined): number {
  return aMxn(monto, moneda, tc).monto;
}

/**
 * P1-7 — Registra en `exclusiones` las cuentas cuya moneda no tiene TC válido,
 * para que la UI marque el saldo consolidado como incompleto.
 */
function registrarCuentasSinTc(
  cuentas: ResumenCuenta[],
  tasas: TasasCambio,
  exclusiones: Exclusiones,
): void {
  exclusiones.incompleto = true;
  for (const c of cuentas) {
    const moneda = (c.moneda ?? "MXN").toUpperCase();
    if (moneda === "MXN") continue;
    if (!aMxn(c.saldo, moneda, tcDeMoneda(moneda, tasas)).completo) {
      exclusiones.registrar(c.saldo, moneda);
    }
  }
}

export function calcularFlujoProyectado(args: {
  cuentas: ResumenCuenta[];
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  liquidaciones: LiquidacionRow[];
  dias: number;
  hoy?: Date;
  /**
   * v13.300.49 — TC USD→MXN para convertir el saldo inicial de cuentas
   * en USD. Antes se sumaban USD como si fueran MXN, inflando el saldo
   * inicial del flujo proyectado.
   */
  tipoCambioUsd?: number;
  /** P1-7 — Tipo de cambio EUR→MXN, mismo tratamiento que `tipoCambioUsd`. */
  tipoCambioEur?: number;
  /** Q-06: fecha (YYYY-MM-DD) del TC DOF aplicado, sólo para exhibir en UI. */
  tipoCambioFecha?: string | null;
}): FlujoProyectado {
  const hoy = args.hoy ?? new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + args.dias);

  const semanasMap = new Map<string, SemanaFlujo>();
  let cursor = inicioSemana(hoy);
  while (cursor <= limite) {
    const fin = new Date(cursor); fin.setDate(fin.getDate() + 6);
    const key = isoWeekKey(cursor);
    semanasMap.set(key, {
      semana_iso: key,
      inicio: formatDateOnlyLocal(cursor),
      fin: formatDateOnlyLocal(fin),
      entradas_mxn: 0, salidas_mxn: 0, flujo_neto_mxn: 0, saldo_proyectado_mxn: 0,
      detalle_entradas: [], detalle_salidas: [],
    });
    cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 7);
  }

  const exclusiones = new Exclusiones();

  const tasas: TasasCambio = { usdMxn: args.tipoCambioUsd, eurMxn: args.tipoCambioEur };

  // Q-06/P1-7: mismo canon (`aMxn`) que el resumen para el saldo inicial de
  // cuentas, cubriendo todas las monedas del canon (no sólo USD).
  const { total: saldoInicial, incompleto: saldoInicialIncompleto } =
    sumarSaldosCuentas(args.cuentas, tasas);
  if (saldoInicialIncompleto) registrarCuentasSinTc(args.cuentas, tasas, exclusiones);

  const inWindow = (iso: string | null): SemanaFlujo | null => {
    if (!iso) return null;
    const d = parseDateOnlyLocal(iso);
    if (d < inicioSemana(hoy) || d > limite) return null;
    return semanasMap.get(isoWeekKey(d)) ?? null;
  };

  aplicarCobranza(args.cobranza, inWindow, exclusiones);
  aplicarCxp(args.cxp, inWindow, exclusiones);
  aplicarLiquidaciones(args.liquidaciones, inWindow);

  let saldo = saldoInicial;
  let totalEnt = 0, totalSal = 0, alertas = 0;
  const semanas = Array.from(semanasMap.values()).sort((a, b) => a.inicio.localeCompare(b.inicio));
  for (const s of semanas) {
    s.flujo_neto_mxn = s.entradas_mxn - s.salidas_mxn;
    saldo += s.flujo_neto_mxn;
    s.saldo_proyectado_mxn = saldo;
    totalEnt += s.entradas_mxn;
    totalSal += s.salidas_mxn;
    if (s.saldo_proyectado_mxn < 0) alertas += 1;
  }

  return {
    saldo_inicial_mxn: saldoInicial,
    semanas,
    total_entradas_mxn: totalEnt,
    total_salidas_mxn: totalSal,
    saldo_final_mxn: saldo,
    alertas_negativas: alertas,
    saldo_incompleto: exclusiones.incompleto,
    excluido_por_moneda: exclusiones.porMoneda,
    tipo_cambio_usd: args.tipoCambioUsd ?? null,
    tipo_cambio_eur: args.tipoCambioEur ?? null,
    tipo_cambio_fecha: args.tipoCambioFecha ?? null,
  };
}
