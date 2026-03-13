import { useMemo } from "react";
import { useEmbarques, calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { calcularUtilidad } from "@/lib/financialUtils";
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { useProfitMaps } from "@/hooks/useProfitMaps";

const ESTADOS_TERMINALES = ["EIR", "Cerrado", "Cancelado"];
const DIAS_LIBRES_DEFAULT = 7;
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
  cargasEnRiesgo: CargaRiesgo[];
  historicoCreadosPorMes: { mes: string; valor: number }[];
  historicoLlegadosPorMes: { mes: string; valor: number }[];
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

function generarUltimos6Meses(): { inicio: Date; fin: Date; label: string }[] {
  const hoy = new Date();
  const meses: { inicio: Date; fin: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(hoy, i);
    meses.push({
      inicio: startOfMonth(d),
      fin: endOfMonth(d),
      label: format(d, "MMM", { locale: es }),
    });
  }
  return meses;
}

function calcularNivelRiesgo(
  estadoReal: string,
  eta: string | null,
  hoy: Date
): { nivel: NivelRiesgo; diasEnPuerto: number } {
  if (["Arribo", "En Aduana"].includes(estadoReal) && eta) {
    const fechaEta = new Date(eta + "T00:00:00");
    const dias = differenceInCalendarDays(hoy, fechaEta);
    if (dias > DIAS_LIBRES_DEFAULT) {
      return { nivel: "critico", diasEnPuerto: dias };
    }
    return { nivel: "en_puerto", diasEnPuerto: Math.max(dias, 0) };
  }
  if (estadoReal === "En Tránsito" && eta) {
    const fechaEta = new Date(eta + "T00:00:00");
    const diasParaLlegar = differenceInCalendarDays(fechaEta, hoy);
    if (diasParaLlegar <= 7 && diasParaLlegar >= 0) {
      return { nivel: "por_arribar", diasEnPuerto: 0 };
    }
  }
  return { nivel: "ok", diasEnPuerto: 0 };
}

const RIESGO_ORDER: Record<NivelRiesgo, number> = {
  critico: 0,
  en_puerto: 1,
  por_arribar: 2,
  ok: 3,
};

export function useOperacionesData(periodo: PeriodoFiltro = "mes") {
  const { data: embarques = [], isLoading } = useEmbarques();
  const { ventaMap, costoMap } = useProfitMaps();

  const meses6 = useMemo(() => generarUltimos6Meses(), []);

  const embarquesConEstado = useMemo(
    () =>
      embarques.map((e) => ({
        ...e,
        estadoReal: calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
      })),
    [embarques]
  );

  const activos = useMemo(
    () => embarquesConEstado.filter((e) => !ESTADOS_TERMINALES.includes(e.estadoReal)),
    [embarquesConEstado]
  );

  // Per-operator data
  const operadores = useMemo<OperadorData[]>(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const inicioMes = startOfMonth(hoy);
    const finMes = endOfMonth(hoy);
    const map = new Map<string, {
      activas: number;
      contenedores: number;
      esteMes: number;
      profit: number;
      demoras: number;
      criticos: number;
      enPuerto: number;
      porArribar: number;
      clientes: Set<string>;
      cargasEnRiesgo: CargaRiesgo[];
      creadosPorMes: Record<string, number>;
      llegadosPorMes: Record<string, number>;
    }>();

    const getOrCreate = (op: string) => {
      if (!map.has(op)) {
        const creadosPorMes: Record<string, number> = {};
        const llegadosPorMes: Record<string, number> = {};
        meses6.forEach((m) => {
          creadosPorMes[m.label] = 0;
          llegadosPorMes[m.label] = 0;
        });
        map.set(op, {
          activas: 0,
          contenedores: 0,
          esteMes: 0,
          profit: 0,
          demoras: 0,
          criticos: 0,
          enPuerto: 0,
          porArribar: 0,
          clientes: new Set(),
          cargasEnRiesgo: [],
          creadosPorMes,
          llegadosPorMes,
        });
      }
      return map.get(op)!;
    };

    embarquesConEstado.forEach((e) => {
      const op = e.operador || "Sin Asignar";
      const d = getOrCreate(op);

      const venta = ventaMap[e.id] || 0;
      const costo = costoMap[e.id] || 0;
      const embarqueProfit = (venta > 0 || costo > 0) ? calcularUtilidad(venta, costo) : 0;

      // Activas
      if (!ESTADOS_TERMINALES.includes(e.estadoReal)) {
        d.activas++;
        d.contenedores++;
        d.clientes.add(e.cliente_nombre);

        // Risk level
        const { nivel, diasEnPuerto } = calcularNivelRiesgo(e.estadoReal, e.eta, hoy);
        if (nivel === "critico") d.criticos++;
        if (nivel === "en_puerto") d.enPuerto++;
        if (nivel === "por_arribar") d.porArribar++;

        if (nivel !== "ok") {
          d.cargasEnRiesgo.push({
            id: e.id,
            expediente: e.expediente,
            cliente_nombre: e.cliente_nombre,
            operador: op,
            estadoReal: e.estadoReal,
            nivelRiesgo: nivel,
            eta: e.eta,
            diasEnPuerto,
            profit: embarqueProfit,
          });
        }
      }

      // ETD este mes
      const fechaOperacion = e.etd ? new Date(e.etd + "T00:00:00") : new Date(e.created_at);
      if (isWithinInterval(fechaOperacion, { start: inicioMes, end: finMes })) {
        d.esteMes++;
      }

      // Profit
      d.profit += embarqueProfit;

      // Demoras
      if (e.estadoReal === "Arribo" && e.eta) {
        const eta = new Date(e.eta + "T00:00:00");
        const dias = Math.floor((hoy.getTime() - eta.getTime()) / 864e5);
        if (dias > DIAS_LIBRES_DEFAULT) d.demoras++;
      }

      // Histórico por ETD
      meses6.forEach((m) => {
        if (isWithinInterval(fechaOperacion, { start: m.inicio, end: m.fin })) {
          d.creadosPorMes[m.label]++;
        }
      });

      // Histórico llegados
      const fechaLlegada = e.fecha_llegada_real
        ? new Date(e.fecha_llegada_real + "T00:00:00")
        : ["Entregado", "EIR", "Cerrado"].includes(e.estadoReal) && e.eta
          ? new Date(e.eta + "T00:00:00")
          : null;

      if (fechaLlegada) {
        meses6.forEach((m) => {
          if (isWithinInterval(fechaLlegada, { start: m.inicio, end: m.fin })) {
            d.llegadosPorMes[m.label]++;
          }
        });
      }
    });

    return Array.from(map.entries())
      .map(([nombre, d]) => {
        d.cargasEnRiesgo.sort((a, b) => RIESGO_ORDER[a.nivelRiesgo] - RIESGO_ORDER[b.nivelRiesgo]);
        return {
          nombre,
          cargasActivas: d.activas,
          contenedores: d.contenedores,
          cargasEsteMes: d.esteMes,
          profit: d.profit,
          demoras: d.demoras,
          criticos: d.criticos,
          enPuerto: d.enPuerto,
          porArribar: d.porArribar,
          clientes: Array.from(d.clientes),
          cargasEnRiesgo: d.cargasEnRiesgo,
          historicoCreadosPorMes: meses6.map((m) => ({ mes: m.label, valor: d.creadosPorMes[m.label] })),
          historicoLlegadosPorMes: meses6.map((m) => ({ mes: m.label, valor: d.llegadosPorMes[m.label] })),
        };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [embarquesConEstado, ventaMap, costoMap, meses6]);

  // Global
  const global = useMemo<OperacionesGlobal>(() => {
    const totalActivas = operadores.reduce((s, o) => s + o.cargasActivas, 0);
    const totalContenedores = operadores.reduce((s, o) => s + o.contenedores, 0);
    const totalEsteMes = operadores.reduce((s, o) => s + o.cargasEsteMes, 0);
    const totalProfit = operadores.reduce((s, o) => s + o.profit, 0);
    const totalDemoras = operadores.reduce((s, o) => s + o.demoras, 0);
    const totalCriticos = operadores.reduce((s, o) => s + o.criticos, 0);
    const totalEnPuerto = operadores.reduce((s, o) => s + o.enPuerto, 0);
    const totalPorArribar = operadores.reduce((s, o) => s + o.porArribar, 0);

    const historico: HistoricoMes[] = meses6.map((m) => {
      const creadas = operadores.reduce(
        (s, o) => s + (o.historicoCreadosPorMes.find((h) => h.mes === m.label)?.valor || 0),
        0
      );
      const llegadas = operadores.reduce(
        (s, o) => s + (o.historicoLlegadosPorMes.find((h) => h.mes === m.label)?.valor || 0),
        0
      );
      return { mes: m.label, creadas, llegadas };
    });

    const ultimoMes = historico[historico.length - 1];

    const cargasEnRiesgo = operadores
      .flatMap((o) => o.cargasEnRiesgo)
      .sort((a, b) => RIESGO_ORDER[a.nivelRiesgo] - RIESGO_ORDER[b.nivelRiesgo]);

    return {
      totalActivas,
      totalContenedores,
      totalEsteMes,
      totalProfit,
      totalDemoras,
      totalCriticos,
      totalEnPuerto,
      totalPorArribar,
      activasHoy: activos.length,
      historicoCreadosPorMes: historico,
      creadasEsteMes: ultimoMes?.creadas || 0,
      llegadasEsteMes: ultimoMes?.llegadas || 0,
      cargasEnRiesgo,
    };
  }, [operadores, activos, meses6]);

  return {
    isLoading,
    operadores,
    global,
    meses6Labels: meses6.map((m) => m.label),
  };
}
