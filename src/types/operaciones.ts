/**
 * Tipos de dominio puros para Operaciones.
 * Re-exportados por `hooks/operaciones/useOperacionesData` para preservar
 * la API existente y permitir consumo desde `lib/operaciones/*` sin invertir capas.
 */

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

export interface CargaRiesgo {
  embarque_id: string;
  expediente: string;
  cliente: string;
  motivo: string;
  diasRestantes?: number;
}

export interface EmbarquesPorEstado {
  Confirmado: number;
  "En Tránsito": number;
  Llegada: number;
  "En Proceso": number;
  Cerrado: number;
}

export interface OperadorData {
  nombre: string;
  cargasActivas: number;
  contenedores: number;
  cargasEsteMes: number;
  profit: number;
  demoras: number;
  criticos: number;
  enPuerto: number;
  porArribar: number;
  clientes: string[];
  clientesDesglose: ClienteCarga[];
  desgloseEstados: DesgloseEstados;
  cargasEnRiesgo: CargaRiesgo[];
  historicoCreadosPorMes: { mes: string; valor: number }[];
  historicoLlegadosPorMes: { mes: string; valor: number }[];
  embarquesPorEstado: EmbarquesPorEstado;
}
