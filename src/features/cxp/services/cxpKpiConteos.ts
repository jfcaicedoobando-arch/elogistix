/**
 * Conteos y "programado 7d" de las tarjetas de CxP.
 *
 * Helper puro extraído de `CxpKpiCards.tsx` para que los CONTEOS usen el mismo
 * canon de deuda que los IMPORTES (`calcularKPIsCxP` + `esFacturaPorPagar`):
 * antes la tarjeta contaba cualquier factura con saldo (incluidas Rechazada,
 * Cancelada y Borrador) y usaba el estatus derivado "Por vencer" (ventana de
 * 5 días) mientras el importe usaba la ventana canónica de 7 días.
 *
 * Sin red, sin React.
 */
import type { FacturaCxP } from "./proveedorFacturas";
import { esFacturaPorPagar } from "./cxpPorPagarFiltro";
import { esVencidoPorDias, estaPorVencer, DIAS_POR_VENCER_CXC } from "@/lib/domain/vencimiento";
import { todayLocalISO, todayLocalISOPlus } from "@/lib/date/today";
import { diasVencidos } from "@/lib/date/dateOnly";

export interface ConteosTarjetasCxP {
  porPagarMxn: number;
  porPagarUsd: number;
  vencidasN: number;
  porVencerN: number;
  programadoMxn: number;
  programadoUsd: number;
  programadoN: number;
}

export function resumirTarjetasCxP(
  filas: FacturaCxP[],
  hoyIso: string = todayLocalISO(),
): ConteosTarjetasCxP {
  const r: ConteosTarjetasCxP = {
    porPagarMxn: 0, porPagarUsd: 0, vencidasN: 0, porVencerN: 0,
    programadoMxn: 0, programadoUsd: 0, programadoN: 0,
  };
  const limite = todayLocalISOPlus(DIAS_POR_VENCER_CXC, new Date(`${hoyIso}T12:00:00Z`));
  for (const f of filas) {
    // Mismo canon que los importes: sin Rechazada / Cancelada / Borrador.
    if (!esFacturaPorPagar(f)) continue;
    const usd = f.moneda === "USD";
    const mxn = f.moneda === "MXN";
    if (usd) r.porPagarUsd++; else if (mxn) r.porPagarMxn++;
    // `f.dias_vencido` viene de `mapJoinedRow` como Math.max(0, dv): en
    // producción NUNCA es negativo, así que "por vencer" salía siempre true y
    // las vencidas dependían de un valor recortado. Derivamos los días del
    // canon date-only contra `hoyIso`, igual que `calcularKPIsCxP`.
    const venc = f.fecha_vencimiento?.slice(0, 10);
    if (venc) {
      const dv = diasVencidos(venc, hoyIso);
      if (esVencidoPorDias(dv)) r.vencidasN++;
      else if (estaPorVencer(dv)) r.porVencerN++;
    }
    const prog = f.fecha_programada_pago?.slice(0, 10);
    if (prog && prog >= hoyIso && prog <= limite) {
      r.programadoN++;
      // EUR (u otra moneda) nunca se suma a MXN: sólo cuenta en el conteo.
      if (usd) r.programadoUsd += f.saldo; else if (mxn) r.programadoMxn += f.saldo;
    }
  }
  return r;
}
