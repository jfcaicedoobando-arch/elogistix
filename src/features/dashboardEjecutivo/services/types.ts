/**
 * Tipos del snapshot del Dashboard Ejecutivo Financiero.
 */
import type { EstadoResultados } from "@/features/profit/domain/estadoResultados";
import type { ResumenTesoreria, TopItem } from "@/features/tesoreria/services";
import type { FlujoProyectado } from "@/features/tesoreria/services";
import type { ResumenVsReal } from "@/features/presupuesto/services";

export type SeveridadAlerta = "info" | "warning" | "critica";

export interface AlertaEjecutiva {
  id: string;
  severidad: SeveridadAlerta;
  titulo: string;
  descripcion: string;
  url?: string;
}

export interface PuntoEERR {
  periodo: string;
  ingresos: number;
  costos: number;
  utilidad: number;
}

export interface KPIsEjecutivos {
  ingresos_mxn: number;
  ingresos_delta_pct: number;
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
}

export interface SnapshotEjecutivo {
  periodo: string;
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
}
