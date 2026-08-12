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
} from "./resumen.types";
import { aMxn } from "@/lib/financial/convertir";
import type {
  ResumenCuenta,
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
  /** Q-06: fecha (YYYY-MM-DD) del TC DOF aplicado, sólo para exhibir en UI. */
  tipoCambioFecha?: string | null;
}): ResumenTesoreria {
  const hoy = args.hoy ?? new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 30);
  const enVentana = (iso: string | null) =>
    !!iso && new Date(iso + "T00:00:00") <= limite;
  // UIA-03: sin TC confiable NO se asume 1:1 — la porción en USD queda
  // excluida de los totales MXN y se reporta vía `flujo_incompleto`.
  const tc =
    typeof args.tipoCambioUsd === "number" && args.tipoCambioUsd > 1 ? args.tipoCambioUsd : 0;
  const tcConfiable = tc > 0;

  const flujo = calcularFlujo(args.cobranza, args.cxp, enVentana, tc);
  flujo.flujo_incompleto =
    !tcConfiable && (flujo.por_cobrar_usd > 0 || flujo.por_pagar_usd > 0);
  const vencidasCobranza = sumarVencidas(args.cobranza, (f) => f.estatus_cobranza, tc);
  const vencidasCxp = sumarVencidas(args.cxp, (f) => f.estatus, tc);

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
    sumarSaldosCuentas(args.cuentas, args.tipoCambioUsd);

  return {
    cuentas: args.cuentas,
    flujo,
    top_deudores,
    top_acreedores,
    saldo_bancos_mxn,
    saldo_bancos_incompleto,
    saldos_por_moneda,
    tipo_cambio_usd: args.tipoCambioUsd ?? null,
    tipo_cambio_fecha: args.tipoCambioFecha ?? null,
    cartera_vencida_total_mxn: vencidasCobranza.total_mxn,
    cartera_vencida_count: vencidasCobranza.count,
    cxp_vencidas_count: vencidasCxp.count,
    cxp_vencidas_total_mxn: vencidasCxp.total_mxn,
  };
}

/**
 * Q-06 · Suma saldos de cuentas convirtiendo divisas con `aMxn` (canon único).
 * Sin TC confiable, la cuenta en divisa extranjera NO se suma a `total`
 * (queda marcada en `incompleto` y su monto nominal en `porMoneda`).
 */
export function sumarSaldosCuentas(
  cuentas: ResumenCuenta[],
  tipoCambioUsd?: number,
): { total: number; incompleto: boolean; porMoneda: Record<string, number> } {
  let total = 0;
  let incompleto = false;
  const porMoneda: Record<string, number> = {};
  for (const c of cuentas) {
    const moneda = (c.moneda ?? "MXN").toUpperCase();
    porMoneda[moneda] = (porMoneda[moneda] ?? 0) + c.saldo;
    const conv = aMxn(c.saldo, moneda, moneda === "USD" ? tipoCambioUsd : undefined);
    if (conv.completo) total += conv.monto;
    else incompleto = true;
  }
  return { total, incompleto, porMoneda };
}

import { calcularFlujo, sumarVencidas, agruparTop } from "./resumenHelpers";
