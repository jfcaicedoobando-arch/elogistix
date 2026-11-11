import {
  calcularFlujoProyectado,
  calcularResumenTesoreria,
  type CobranzaRow,
  type CxpRow,
  type LiquidacionRow,
  type ResumenCuenta,
} from "@/features/tesoreria/domain";
import { avisoNcProveedorSinBase } from "@/lib/financial/baseNcProveedor";
import { parseDateOnlyLocal } from "@/lib/date/dateOnly";
import { calcularVencimientosEjecutivos } from "../domain/vencimientos";
import type { FuentesDashboardEjecutivo } from "./agregador";
import { calcularAlertas, calcularKPIsEjecutivos } from "./alertas";
import type { FinancialAnalysis } from "./financialAnalysis";
import type { SnapshotEjecutivo } from "./types";

export function construirSnapshotEjecutivo({
  fuentes, cuentas, cobranza, cxp, liquidaciones, financialAnalysis, generadoEn,
}: {
  fuentes: FuentesDashboardEjecutivo;
  cuentas: ResumenCuenta[];
  cobranza: CobranzaRow[];
  cxp: CxpRow[];
  liquidaciones: LiquidacionRow[];
  financialAnalysis: FinancialAnalysis;
  generadoEn: string;
}): SnapshotEjecutivo {
  const { periodo, fuente, eerrPeriodo, eerrPrev, eerr12m, presupuesto, tipoCambio } = fuentes;
  const tipoCambioUsd = tipoCambio.usdMxn;
  const tcEsFallback = tipoCambio.esFallback === true;
  // El EUR estimado conserva los importes nominales y la valuación incompleta.
  const tipoCambioEur = tipoCambio.eurEsFallback === true ? undefined : tipoCambio.eurMxn;
  const tipoCambioFecha = tipoCambio.fechaAplicada ?? null;
  const hoy = parseDateOnlyLocal(financialAnalysis.currentBalanceReference);
  const tesoreriaInputs = { cuentas, cobranza, cxp, hoy, tipoCambioUsd, tipoCambioEur, tipoCambioFecha };
  const tesoreria = calcularResumenTesoreria(tesoreriaInputs);
  const flujo = calcularFlujoProyectado({ ...tesoreriaInputs, liquidaciones, dias: 28 });
  const vencimientos = calcularVencimientosEjecutivos({
    cobranza, cxp, hoy, tasas: { usdMxn: tipoCambioUsd, eurMxn: tipoCambioEur },
  });
  const base = { periodo, fuente, vencimientos, eerrPeriodo, eerr12m, tesoreria, flujo, presupuesto, tipoCambioUsd, tcEsFallback };
  const kpis = calcularKPIsEjecutivos(base, eerrPrev.totalIngresos.total, eerrPrev);
  const alertas = calcularAlertas({ flujo, tesoreria, presupuesto });
  const eerrUrl = `/profit/estado-resultados?${new URLSearchParams({ mes: periodo, fuente })}`;
  if (kpis.eerr_incompleto) alertas.unshift({ id: "eerr-valuacion-incompleta", severidad: "warning", titulo: "EERR parcial", descripcion: "Conceptos sin TC excluidos de ingresos o costos. Utilidad parcial; margen y ratios no disponibles.", url: eerrUrl });
  const sinBase = Math.max(eerrPeriodo.notas_proveedor_sin_base?.length ?? 0, eerrPrev.notas_proveedor_sin_base?.length ?? 0, presupuesto.notas_proveedor_sin_base_count ?? 0, eerr12m.reduce((s, p) => s + (p.notas_proveedor_sin_base_count ?? 0), 0));
  if (sinBase) alertas.unshift({ id: "nc-proveedor-sin-base", severidad: "warning", titulo: "Resultados provisionales", descripcion: avisoNcProveedorSinBase(sinBase), url: eerrUrl });

  return {
    ...base,
    financialAnalysis,
    generadoEn,
    kpis,
    topDeudores: tesoreria.top_deudores,
    topAcreedores: tesoreria.top_acreedores,
    alertas,
  };
}
