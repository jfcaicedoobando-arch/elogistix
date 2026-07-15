/**
 * Lógica pura: flujo de caja proyectado por semana ISO a N días.
 * Ver `./resumen.ts` para contexto del refactor (Auditoría Paso 4).
 */
import type { CobranzaRow, CxpRow, LiquidacionRow, ResumenCuenta } from "./resumen";

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
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function toMxn(monto: number, moneda: string, tc: number | undefined): number {
  if (moneda === "MXN") return monto;
  if (!tc || tc <= 0) return monto;
  return monto * tc;
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
}): FlujoProyectado {
  const hoy = args.hoy ?? new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + args.dias);
  const tcSaldo = args.tipoCambioUsd && args.tipoCambioUsd > 0 ? args.tipoCambioUsd : 1;

  const semanasMap = new Map<string, SemanaFlujo>();
  let cursor = inicioSemana(hoy);
  while (cursor <= limite) {
    const fin = new Date(cursor); fin.setDate(fin.getDate() + 6);
    const key = isoWeekKey(cursor);
    semanasMap.set(key, {
      semana_iso: key,
      inicio: cursor.toISOString().slice(0, 10),
      fin: fin.toISOString().slice(0, 10),
      entradas_mxn: 0, salidas_mxn: 0, flujo_neto_mxn: 0, saldo_proyectado_mxn: 0,
      detalle_entradas: [], detalle_salidas: [],
    });
    cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 7);
  }

  const saldoInicial = args.cuentas.reduce(
    (acc, c) => acc + (c.moneda === "USD" ? c.saldo * tcSaldo : c.saldo),
    0,
  );

  const inWindow = (iso: string | null): SemanaFlujo | null => {
    if (!iso) return null;
    const d = new Date(iso + "T00:00:00");
    if (d < inicioSemana(hoy) || d > limite) return null;
    return semanasMap.get(isoWeekKey(d)) ?? null;
  };

  aplicarCobranza(args.cobranza, inWindow);
  aplicarCxp(args.cxp, inWindow);
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
  };
}
