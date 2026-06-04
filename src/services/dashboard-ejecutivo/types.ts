/**
 * Tipos del snapshot del Dashboard Ejecutivo Financiero.
 */
import type { EstadoResultados } from "@/lib/domain/estadoResultados";
import type { ResumenTesoreria, TopItem } from "@/services/tesoreria";
import type { FlujoProyectado } from "@/services/tesoreria";
import type { ResumenVsReal } from "@/services/presupuesto";

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
  margen_pct: number;
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
