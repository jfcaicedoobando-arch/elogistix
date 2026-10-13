/**
 * Tipos del snapshot del Dashboard Ejecutivo Financiero.
 */
import type { EstadoResultados } from "@/features/profit/domain/estadoResultados";
import type { ResumenTesoreria, TopItem } from "@/features/tesoreria/services";
import type { FlujoProyectado } from "@/features/tesoreria/services";
import type { ResumenVsReal } from "@/features/presupuesto/services";
import type { FuenteEERR } from "@/features/profit/domain/fuenteEerr";
import type { FinancialAnalysis } from "./financialAnalysis";
import type { VencimientosEjecutivos } from "../domain/vencimientos";

export type SeveridadAlerta = "info" | "warning" | "critica";

export interface AlertaEjecutiva {
  id: string;
  severidad: SeveridadAlerta;
  titulo: string;
  descripcion: string;
  url?: string;
}

import type { PuntoEERR } from "../types/eerr";
export type { PuntoEERR } from "../types/eerr";

export interface KPIsEjecutivos {
  /** Flags opcionales para snapshots históricos; el agregador siempre los emite. */
  saldo_bancos_incompleto?: boolean;
  cartera_vencida_incompleta?: boolean;
  cxp_7dias_incompleto?: boolean;
  presupuesto_incompleto?: boolean;
  eerr_incompleto?: boolean;
  flujo_incompleto?: boolean;
  tiene_presupuesto?: boolean;
  ingresos_mxn: number;
  /** %Δ ingresos vs. mes anterior. `null` cuando el mes previo tiene ingresos = 0 (sin comparable). */
  ingresos_delta_pct: number | null;
  utilidad_mxn: number;
  /** %Δ de utilidad vs. mes anterior. `null` cuando el mes previo es 0 o negativo. */
  utilidad_delta_pct: number | null;
  margen_pct: number;
  /** Variación del margen en **puntos porcentuales** vs. mes anterior. `null` si no aplica. */
  margen_delta_puntos: number | null;
  saldo_bancos_mxn: number;
  cartera_vencida_mxn: number;
  cartera_vencida_count: number;
  cxp_7dias_mxn: number;
  cumplimiento_presupuesto_pct: number;
  /** Fase J: categorías con cumplimiento > 110% en el periodo actual. */
  categorias_en_exceso: number;
  /** Legacy single-currency fields remain null. See financialAnalysis for N/D causes by currency. */
  dso_dias: number | null;
  dpo_dias: number | null;
  runway_meses: number | null;
}

export interface SnapshotEjecutivo {
  /** Optional only for old snapshots/fixtures; missing never enables legacy metrics. */
  financialAnalysis?: FinancialAnalysis;
  periodo: string;
  fuente: FuenteEERR;
  vencimientos: VencimientosEjecutivos;
  generadoEn: string;
  kpis: KPIsEjecutivos;
  eerrPeriodo: EstadoResultados;
  eerr12m: PuntoEERR[];
  tesoreria: ResumenTesoreria;
  flujo: FlujoProyectado;
  presupuesto: ResumenVsReal;
  topDeudores: TopItem[];
  topAcreedores: TopItem[];
  alertas: AlertaEjecutiva[];
  /** TC USD/MXN usado para valuar saldos y flujos del periodo. */
  tipoCambioUsd: number;
  /**
   * Ola 5 · A10 — `true` cuando el TC proviene del fallback operativo porque
   * la fuente DOF no respondió. La UI debe advertir "TC no disponible".
   */
  tcEsFallback: boolean;
}
