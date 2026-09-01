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
  TopItem,
  ResumenTesoreria,
  CobranzaRow,
  CxpRow,
  LiquidacionRow,
  TasasCambio,
} from "./resumen.types";
import { aMxn } from "@/lib/financial/convertir";
import type {
  ResumenCuenta,
  ResumenTesoreria,
  CobranzaRow,
  CxpRow,
  TasasCambio,
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
  /** P1-7 — Tipo de cambio EUR→MXN, mismo tratamiento que `tipoCambioUsd`. */
  tipoCambioEur?: number;
  /** Q-06: fecha (YYYY-MM-DD) del TC DOF aplicado, sólo para exhibir en UI. */
  tipoCambioFecha?: string | null;
}): ResumenTesoreria {
  const hoy = args.hoy ?? new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 30);
  const enVentana = (iso: string | null) =>
    !!iso && new Date(iso + "T00:00:00") <= limite;

  const tasas: TasasCambio = { usdMxn: args.tipoCambioUsd, eurMxn: args.tipoCambioEur };

  const flujo = calcularFlujo(args.cobranza, args.cxp, enVentana, tasas);
  const vencidasCobranza = sumarVencidas(args.cobranza, (f) => f.estatus_cobranza, tasas);
  const vencidasCxp = sumarVencidas(args.cxp, (f) => f.estatus, tasas);

  const top_deudores = agruparTop(args.cobranza, {
    filtro: (f) => f.saldo > 0 && f.estatus_cobranza === "Vencida",
    nombre: (f) => f.cliente_nombre,
    moneda: (f) => f.moneda,
    saldo: (f) => f.saldo,
    dias: (f) => f.dias_vencido,
  });
  const top_acreedores = agruparTop(args.cxp, {
    filtro: (f) => f.saldo > 0 && f.estatus === "Vencida",
    nombre: (f) => f.proveedor_nombre,
    moneda: (f) => f.moneda,
    saldo: (f) => f.saldo,
    dias: (f) => f.dias_vencido,
  });

  const { total: saldo_bancos_mxn, incompleto: saldo_bancos_incompleto, porMoneda: saldos_por_moneda } =
    sumarSaldosCuentas(args.cuentas, tasas);

  return {
    cuentas: args.cuentas,
    flujo,
    top_deudores,
    top_acreedores,
    saldo_bancos_mxn,
    saldo_bancos_incompleto,
    saldos_por_moneda,
    tipo_cambio_usd: args.tipoCambioUsd ?? null,
    tipo_cambio_eur: args.tipoCambioEur ?? null,
    tipo_cambio_fecha: args.tipoCambioFecha ?? null,
    cartera_vencida_total_mxn: vencidasCobranza.total_mxn,
    cartera_vencida_count: vencidasCobranza.count,
    cxp_vencidas_count: vencidasCxp.count,
    cxp_vencidas_total_mxn: vencidasCxp.total_mxn,
  };
}

/**
 * Q-06/P1-7 · Suma saldos de cuentas convirtiendo divisas con `aMxn` (canon
 * único). Sin TC confiable para la moneda de la cuenta, ésta NO se suma a
 * `total` (queda marcada en `incompleto` y su monto nominal en `porMoneda`).
 * Antes sólo se resolvía el TC de USD; una cuenta EUR con TC válido quedaba
 * excluida siempre porque se le pasaba `undefined` a `aMxn`.
 */
export function sumarSaldosCuentas(
  cuentas: ResumenCuenta[],
  tasas: TasasCambio,
): { total: number; incompleto: boolean; porMoneda: Record<string, number> } {
  let total = 0;
  let incompleto = false;
  const porMoneda: Record<string, number> = {};
  for (const c of cuentas) {
    const moneda = (c.moneda ?? "MXN").toUpperCase();
    porMoneda[moneda] = (porMoneda[moneda] ?? 0) + c.saldo;
    const conv = aMxn(c.saldo, moneda, tcDeMoneda(moneda, tasas));
    if (conv.completo) total += conv.monto;
    else incompleto = true;
  }
  return { total, incompleto, porMoneda };
}

import { calcularFlujo, sumarVencidas, agruparTop, tcDeMoneda } from "./resumenHelpers";
