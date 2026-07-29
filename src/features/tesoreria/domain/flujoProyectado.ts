/**
 * Lógica pura: flujo de caja proyectado por semana ISO a N días.
 * Ver `./resumen.ts` para contexto del refactor (Auditoría Paso 4).
 */
import { isoUtcDay } from "@/lib/date/mx";
import { parseDateOnlyLocal } from "@/lib/date/dateOnly";
import { aMxn } from "@/lib/financial/convertir";
import type { CobranzaRow, CxpRow, LiquidacionRow, ResumenCuenta } from "./resumen";
import { sumarSaldosCuentas } from "./resumen";

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
  // v13.303.84 — usar getUTC* al construir la fecha base para no cambiar de
  // semana ISO cuando el runner corre en TZ negativa (America/Mexico_City).
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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

/** Acumulador de exclusiones (montos no convertibles) por moneda. */
class Exclusiones {
  incompleto = false;
  porMoneda: Record<string, number> = {};

  registrar(monto: number, moneda: string): void {
    this.incompleto = true;
    const m = (moneda ?? "MXN").toUpperCase();
    this.porMoneda[m] = (this.porMoneda[m] ?? 0) + monto;
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
      inicio: isoUtcDay(cursor),
      fin: isoUtcDay(fin),
      entradas_mxn: 0, salidas_mxn: 0, flujo_neto_mxn: 0, saldo_proyectado_mxn: 0,
      detalle_entradas: [], detalle_salidas: [],
    });
    cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 7);
  }

  const exclusiones = new Exclusiones();

  // Q-06: mismo canon (`aMxn`) que el resumen para el saldo inicial de cuentas.
  const { total: saldoInicial, incompleto: saldoInicialIncompleto, porMoneda: saldoInicialExcluido } =
    sumarSaldosCuentas(args.cuentas, args.tipoCambioUsd);
  if (saldoInicialIncompleto) {
    exclusiones.incompleto = true;
    for (const c of args.cuentas) {
      const moneda = (c.moneda ?? "MXN").toUpperCase();
      if (moneda === "MXN") continue;
      const conv = aMxn(c.saldo, moneda, moneda === "USD" ? args.tipoCambioUsd : undefined);
      if (!conv.completo) exclusiones.registrar(c.saldo, moneda);
    }
  }
  void saldoInicialExcluido;

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
    tipo_cambio_fecha: args.tipoCambioFecha ?? null,
  };
}

type InWindow = (iso: string | null) => SemanaFlujo | null;

function aplicarCobranza(rows: CobranzaRow[], inWindow: InWindow, exclusiones: Exclusiones): void {
  for (const f of rows) {
    if (f.saldo <= 0) continue;
    const sem = inWindow(f.fecha_vencimiento); if (!sem) continue;
    const conv = aMxn(f.saldo, f.moneda, f.tipo_cambio);
    if (!conv.completo) { exclusiones.registrar(f.saldo, f.moneda); continue; }
    sem.entradas_mxn += conv.monto;
    sem.detalle_entradas.push({
      id: f.id, concepto: `${f.numero} · ${f.cliente_nombre}`,
      monto_mxn: conv.monto, fecha_vencimiento: f.fecha_vencimiento!, moneda: f.moneda,
    });
  }
}

function aplicarCxp(rows: CxpRow[], inWindow: InWindow, exclusiones: Exclusiones): void {
  for (const c of rows) {
    // v13.315.7 (QW1) — fecha efectiva = programada > vencimiento.
    const fechaEfectiva = c.fecha_programada_pago ?? c.fecha_vencimiento;
    if (c.saldo <= 0 || !fechaEfectiva) continue;
    const sem = inWindow(fechaEfectiva); if (!sem) continue;
    const conv = aMxn(c.saldo, c.moneda, c.tipo_cambio_usd);
    if (!conv.completo) { exclusiones.registrar(c.saldo, c.moneda); continue; }
    sem.salidas_mxn += conv.monto;
    sem.detalle_salidas.push({
      id: c.id, concepto: `${c.folio_proveedor} · ${c.proveedor_nombre}`,
      monto_mxn: conv.monto, fecha_vencimiento: fechaEfectiva, moneda: c.moneda,
    });
  }
}

function aplicarLiquidaciones(rows: LiquidacionRow[], inWindow: InWindow): void {
  for (const l of rows) {
    const [y, m] = l.periodo.split("-").map(Number);
    if (!y || !m) continue;
    const dueDate = new Date(y, m, 5);
    const iso = isoUtcDay(dueDate);
    const sem = inWindow(iso); if (!sem) continue;
    sem.salidas_mxn += Number(l.total_mxn);
    sem.detalle_salidas.push({
      id: l.id, concepto: `Liquidación comisión ${l.periodo}`,
      monto_mxn: Number(l.total_mxn), fecha_vencimiento: iso, moneda: "MXN",
    });
  }
}
