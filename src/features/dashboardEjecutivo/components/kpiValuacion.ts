import type { KPIsEjecutivos } from "../services/types";
import { formatCurrency } from "@/lib/formatters/numbers";

export function importeEjecutivo(importe: number, incompleto?: boolean): string {
  return `${incompleto ? "Parcial: " : ""}${formatCurrency(importe, "MXN")}`;
}

export function runwayIncompleto(kpis: KPIsEjecutivos): boolean {
  return kpis.saldo_bancos_incompleto === true || kpis.eerr_incompleto === true;
}

export function eficienciaIncompleta(kpis: KPIsEjecutivos): boolean {
  return kpis.flujo_incompleto === true || kpis.eerr_incompleto === true;
}
