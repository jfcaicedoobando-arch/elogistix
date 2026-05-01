/**
 * Servicio de operaciones: ejecuta el RPC `operaciones_stats` que agrega
 * en el servidor todas las métricas por operador/global usadas por el
 * dashboard de operaciones.
 */
import { supabase } from "@/integrations/supabase/client";

export type NivelRiesgo = "critico" | "en_puerto" | "por_arribar" | "ok";

export interface CargaRiesgo {
  id: string;
  expediente: string;
  cliente_nombre: string;
  operador: string;
  estadoReal: string;
  nivelRiesgo: NivelRiesgo;
  eta: string | null;
  diasEnPuerto: number;
  profit: number;
}

export interface DesgloseEstados {
  Confirmado: number;
  "En Tránsito": number;
  Llegada: number;
  "En Proceso": number;
  Cerrado: number;
}

export interface ClienteCarga {
  nombre: string;
  cantidad: number;
  desgloseEstados: DesgloseEstados;
}

export interface ServerOperador {
  nombre: string;
  cargasActivas: number;
  contenedores: number;
  cargasEsteMes: number;
  profit: number;
  demoras: number;
  criticos: number;
  enPuerto: number;
  porArribar: number;
  desgloseEstados: DesgloseEstados;
  clientesDesglose: ClienteCarga[];
  cargasEnRiesgo: CargaRiesgo[];
  historico: { mes: string; creados: number; llegados: number }[];
}

export interface ServerStats {
  operadores: ServerOperador[];
  global: {
    totalActivas: number; totalContenedores: number; totalEsteMes: number;
    totalProfit: number; totalDemoras: number; totalCriticos: number;
    totalEnPuerto: number; totalPorArribar: number; activasHoy: number;
    maxContenedores: number;
  };
  historicoGlobal: { mes: string; creadas: number; llegadas: number }[];
  mesesLabels: string[];
}

export async function fetchOperacionesStats(): Promise<ServerStats> {
  const { data, error } = await supabase.rpc("operaciones_stats");
  if (error) throw error;
  return data as unknown as ServerStats;
}
