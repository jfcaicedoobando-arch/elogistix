import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchOperacionesStats } from "@/features/operaciones/services";
import type { EmbarquesPorEstado } from "@/features/operaciones/services";

export type {  EmbarquesPorEstadoBucket, EmbarquesPorEstado, EstadoUiKey } from "@/features/operaciones/services";

export const MAX_CONTENEDORES = 150;

export type PeriodoFiltro = "mes" | "3meses" | "anio";
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

export interface ClienteCarga {
  nombre: string;
  cantidad: number;
  desgloseEstados: DesgloseEstados;
}

export interface DesgloseEstados {
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

export interface HistoricoMes {
  mes: string;
  creadas: number;
  llegadas: number;
}

export interface OperacionesGlobal {
  totalActivas: number;
  totalContenedores: number;
  totalEsteMes: number;
  totalProfit: number;
  totalDemoras: number;
  totalCriticos: number;
  totalEnPuerto: number;
  totalPorArribar: number;
  activasHoy: number;
  historicoCreadosPorMes: HistoricoMes[];
  llegadasEsteMes: number;
  creadasEsteMes: number;
  cargasEnRiesgo: CargaRiesgo[];
}

const EMPTY_DESGLOSE: DesgloseEstados = {
  Confirmado: 0, "En Tránsito": 0, Llegada: 0, "En Proceso": 0, Cerrado: 0,
};

const EMPTY_GLOBAL: OperacionesGlobal = {
  totalActivas: 0, totalContenedores: 0, totalEsteMes: 0, totalProfit: 0,
  totalDemoras: 0, totalCriticos: 0, totalEnPuerto: 0, totalPorArribar: 0,
  activasHoy: 0, historicoCreadosPorMes: [], llegadasEsteMes: 0, creadasEsteMes: 0,
  cargasEnRiesgo: [],
};

interface ServerOperador {
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

type StatsShape = Awaited<ReturnType<typeof fetchOperacionesStats>>;

function buildGlobal(stats: StatsShape | undefined, operadores: OperadorData[]): OperacionesGlobal {
  if (!stats?.global) return EMPTY_GLOBAL;
  const g = stats.global;
  const n = (v: unknown) => Number(v ?? 0);
  const historicoGlobal = stats.historicoGlobal ?? [];
  const ultimo = historicoGlobal[historicoGlobal.length - 1];
  return {
    totalActivas: n(g.totalActivas),
    totalContenedores: n(g.totalContenedores),
    totalEsteMes: n(g.totalEsteMes),
    totalProfit: n(g.totalProfit),
    totalDemoras: n(g.totalDemoras),
    totalCriticos: n(g.totalCriticos),
    totalEnPuerto: n(g.totalEnPuerto),
    totalPorArribar: n(g.totalPorArribar),
    activasHoy: n(g.activasHoy),
    historicoCreadosPorMes: historicoGlobal,
    creadasEsteMes: ultimo?.creadas ?? 0,
    llegadasEsteMes: ultimo?.llegadas ?? 0,
    cargasEnRiesgo: operadores.flatMap((o) => o.cargasEnRiesgo),
  };
}

type ServerOperadorRaw = StatsShape extends { operadores?: (infer T)[] } ? T : never;

/**
 * Mapper puro de un operador crudo del RPC a la forma que consume la UI.
 * Extraído para bajar la complejidad ciclomática del hook principal (antes 15).
 */
function mapOperador(op: ServerOperadorRaw): OperadorData {
  const n = (v: unknown) => Number(v ?? 0);
  const historico = op.historico ?? [];
  const clientesDesglose = op.clientesDesglose ?? [];
  return {
    nombre: op.nombre,
    cargasActivas: n(op.cargasActivas),
    contenedores: n(op.contenedores),
    cargasEsteMes: n(op.cargasEsteMes),
    profit: n(op.profit),
    demoras: n(op.demoras),
    criticos: n(op.criticos),
    enPuerto: n(op.enPuerto),
    porArribar: n(op.porArribar),
    clientes: clientesDesglose.map((c) => c.nombre),
    clientesDesglose,
    desgloseEstados: { ...EMPTY_DESGLOSE, ...op.desgloseEstados },
    cargasEnRiesgo: op.cargasEnRiesgo ?? [],
    historicoCreadosPorMes: historico.map((h) => ({ mes: h.mes, valor: h.creados })),
    historicoLlegadosPorMes: historico.map((h) => ({ mes: h.mes, valor: h.llegados })),
    embarquesPorEstado: (op as ServerOperador & { embarquesPorEstado?: EmbarquesPorEstado }).embarquesPorEstado ?? {},
  };
}

/**
 * Operaciones data — powered by server-side RPC `operaciones_stats()`.
 * Replaces previous approach of downloading ALL embarques and aggregating client-side.
 */
export function useOperacionesData(_periodo: PeriodoFiltro = "mes") {
  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.operaciones.stats,
    queryFn: fetchOperacionesStats,
    staleTime: 60_000,
  });

  const operadores = useMemo<OperadorData[]>(
    () => (stats?.operadores ?? []).map(mapOperador),
    [stats],
  );

  const global = useMemo<OperacionesGlobal>(() => buildGlobal(stats, operadores), [stats, operadores]);

  return {
    isLoading,
    isError,
    refetch,
    operadores,
    global,
    meses6Labels: stats?.mesesLabels ?? [],
  };
}

