/**
 * Lógica pura del dominio Tesorería: cálculo de resumen (flujo 30d, top
 * deudores/acreedores) y flujo proyectado semanal a N días.
 *
 * Extraído en v12.95.11 (Auditoría Paso 4) para romper el acoplamiento
 * service→service: `services/tesoreria/{resumen,flujoProyectado}.ts`
 * importaban directamente `@/services/facturas` y `@/services/cxp`. Ahora
 * los hooks componen las fuentes y pasan los datos a estas funciones puras.
 */

export type {
  ResumenCuenta,
  FlujoMes,
  TopItem,
  ResumenTesoreria,
  CobranzaRow,
  CxpRow,
  LiquidacionRow,
} from "./resumen.types";
import type {
  ResumenCuenta,
  FlujoMes,
  TopItem,
  ResumenTesoreria,
  CobranzaRow,
  CxpRow,
} from "./resumen.types";


export function calcularResumenTesoreria(args: {
  cuentas: ResumenCuenta[];
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  hoy?: Date;
  /**
   * v13.300.49 — Tipo de cambio USD→MXN. Se usa para convertir saldos de
   * cuentas en USD y la porción USD de la cartera vencida. Si no se
   * proporciona, se usa `1` (compatibilidad con callers que no manejan TC).
   */
  tipoCambioUsd?: number;
}): ResumenTesoreria {
  const hoy = args.hoy ?? new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 30);
  const enVentana = (iso: string | null) =>
    !!iso && new Date(iso + "T00:00:00") <= limite;
  const tc = args.tipoCambioUsd && args.tipoCambioUsd > 0 ? args.tipoCambioUsd : 1;

  const flujo: FlujoMes = {
    por_cobrar_mxn: 0, por_cobrar_usd: 0,
    por_pagar_mxn: 0, por_pagar_usd: 0,
    flujo_neto_mxn: 0, flujo_neto_usd: 0,
    por_cobrar_total_mxn: 0, por_pagar_total_mxn: 0,
  };
  for (const f of args.cobranza) {
    if (!enVentana(f.fecha_vencimiento) || f.saldo <= 0) continue;
    if (f.moneda === "USD") flujo.por_cobrar_usd += f.saldo;
    else flujo.por_cobrar_mxn += f.saldo;
  }
  for (const f of args.cxp) {
    if (!enVentana(f.fecha_vencimiento) || f.saldo <= 0) continue;
    if (f.moneda === "USD") flujo.por_pagar_usd += f.saldo;
    else flujo.por_pagar_mxn += f.saldo;
  }
  flujo.flujo_neto_mxn = flujo.por_cobrar_mxn - flujo.por_pagar_mxn;
  flujo.flujo_neto_usd = flujo.por_cobrar_usd - flujo.por_pagar_usd;
  flujo.por_cobrar_total_mxn = flujo.por_cobrar_mxn + flujo.por_cobrar_usd * tc;
  flujo.por_pagar_total_mxn = flujo.por_pagar_mxn + flujo.por_pagar_usd * tc;

  // Cartera vencida completa (previa al Top-5). Convertida a MXN.
  let cartera_vencida_total_mxn = 0;
  let cartera_vencida_count = 0;
  for (const f of args.cobranza) {
    if (f.saldo <= 0 || f.estatus_cobranza !== "Vencida") continue;
    cartera_vencida_count += 1;
    cartera_vencida_total_mxn += f.moneda === "USD" ? f.saldo * tc : f.saldo;
  }

  // CxP vencidas completas (previa al Top-5). C1: alineado a sólo "Vencida"
  // (antes acreedores incluía "Por vencer", inconsistente con deudores).
  let cxp_vencidas_total_mxn = 0;
  let cxp_vencidas_count = 0;
  for (const f of args.cxp) {
    if (f.saldo <= 0 || f.estatus !== "Vencida") continue;
    cxp_vencidas_count += 1;
    cxp_vencidas_total_mxn += f.moneda === "USD" ? f.saldo * tc : f.saldo;
  }

  const top_deudores = agruparTop(
    args.cobranza,
    (f) => f.saldo > 0 && f.estatus_cobranza === "Vencida",
    (f) => f.cliente_nombre,
    (f) => f.moneda,
    (f) => f.saldo,
    (f) => f.dias_vencido,
  );

  // C1 fix: criterio unificado con deudores → sólo `Vencida`.
  const top_acreedores = agruparTop(
    args.cxp,
    (f) => f.saldo > 0 && f.estatus === "Vencida",
    (f) => f.proveedor_nombre,
    (f) => f.moneda,
    (f) => f.saldo,
    (f) => f.dias_vencido,
  );

  const saldo_bancos_mxn = args.cuentas.reduce(
    (acc, c) => acc + (c.moneda === "USD" ? c.saldo * tc : c.saldo),
    0,
  );

  return {
    cuentas: args.cuentas,
    flujo,
    top_deudores,
    top_acreedores,
    saldo_bancos_mxn,
    cartera_vencida_total_mxn,
    cartera_vencida_count,
    cxp_vencidas_count,
    cxp_vencidas_total_mxn,
  };
}

/**
 * Agrupa facturas/CxP por nombre+moneda antes de rankear (fix bug: antes
 * el top mostraba facturas individuales, por lo que un mismo cliente con
 * múltiples facturas vencidas aparecía varias veces en el top 5).
 * `dias` se conserva como el peor caso (más días vencidos) del grupo.
 */
function agruparTop<T>(
  rows: T[],
  filtro: (r: T) => boolean,
  nombreOf: (r: T) => string,
  monedaOf: (r: T) => string,
  saldoOf: (r: T) => number,
  diasOf: (r: T) => number | undefined,
): TopItem[] {
  const acc = new Map<string, TopItem>();
  for (const r of rows) {
    if (!filtro(r)) continue;
    const nombre = nombreOf(r);
    const moneda = monedaOf(r);
    const key = `${nombre}||${moneda}`;
    const dias = diasOf(r);
    const prev = acc.get(key);
    if (prev) {
      prev.saldo += saldoOf(r);
      if (dias != null && (prev.dias == null || dias > prev.dias)) prev.dias = dias;
    } else {
      acc.set(key, { nombre, saldo: saldoOf(r), moneda, dias });
    }
  }
  return Array.from(acc.values())
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 5);
}
