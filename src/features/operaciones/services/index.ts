/**
 * Servicio de operaciones: ejecuta el RPC `operaciones_stats` que agrega
 * en el servidor todas las métricas por operador/global usadas por el
 * dashboard de operaciones.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

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

export type EstadoUiKey = keyof DesgloseEstados;

export interface EmbarqueResumen {
  id: string;
  expediente: string;
  clienteNombre: string;
  modo: string;
  tipo: string;
  origen: string;
  destino: string;
  etd: string | null;
  eta: string | null;
  estadoReal: string;
  diasEnPuerto: number;
  diasParaEta: number | null;
}

export interface EmbarquesPorEstadoBucket {
  total: number;
  truncated: boolean;
  items: EmbarqueResumen[];
}

export type EmbarquesPorEstado = Partial<Record<EstadoUiKey, EmbarquesPorEstadoBucket>>;

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
  embarquesPorEstado?: EmbarquesPorEstado;
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
  return fromDb<ServerStats>(data);
}
