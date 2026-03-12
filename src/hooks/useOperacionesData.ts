import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmbarques, calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { calcularUtilidad } from "@/lib/financialUtils";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

const ESTADOS_TERMINALES = ["EIR", "Cerrado", "Cancelado"];
const DIAS_LIBRES_DEFAULT = 7;

export type PeriodoFiltro = "mes" | "3meses" | "anio";

export interface OperadorData {
  nombre: string;
  cargasActivas: number;
  cargasEsteMes: number;
  profit: number;
  demoras: number;
  clientes: string[];
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
  totalEsteMes: number;
  totalProfit: number;
  totalDemoras: number;
  activasHoy: number;
  historicoCreadosPorMes: HistoricoMes[];
  llegadasEsteMes: number;
  creadasEsteMes: number;
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

export function useOperacionesData(periodo: PeriodoFiltro = "mes") {
  const { data: embarques = [], isLoading } = useEmbarques();

  const { data: ventasUSD = [] } = useQuery({
    queryKey: queryKeys.dashboard.ventasUSD,
    queryFn: async () => {
      const { data } = await supabase
        .from("conceptos_venta")
        .select("embarque_id, total")
        .eq("moneda", "USD");
      return data ?? [];
    },
  });

  const { data: costosUSD = [] } = useQuery({
    queryKey: queryKeys.dashboard.costosUSD,
    queryFn: async () => {
      const { data } = await supabase
        .from("conceptos_costo")
        .select("embarque_id, monto")
        .eq("moneda", "USD");
      return data ?? [];
    },
  });

  const meses6 = useMemo(() => generarUltimos6Meses(), []);

  const { ventaMap, costoMap } = useMemo(() => {
    const vm: Record<string, number> = {};
    const cm: Record<string, number> = {};
    ventasUSD.forEach((v) => {
      vm[v.embarque_id] = (vm[v.embarque_id] || 0) + Number(v.total);
    });
    costosUSD.forEach((c) => {
      cm[c.embarque_id] = (cm[c.embarque_id] || 0) + Number(c.monto);
    });
    return { ventaMap: vm, costoMap: cm };
  }, [ventasUSD, costosUSD]);

  // Filter embarques by period
  const embarquesFiltrados = useMemo(() => {
    const hoy = new Date();
    let desde: Date;
    if (periodo === "mes") {
      desde = startOfMonth(hoy);
    } else if (periodo === "3meses") {
      desde = startOfMonth(subMonths(hoy, 2));
    } else {
      desde = new Date(hoy.getFullYear(), 0, 1);
    }
    return embarques.filter((e) => new Date(e.created_at) >= desde);
  }, [embarques, periodo]);

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
    const inicioMes = startOfMonth(hoy);
    const finMes = endOfMonth(hoy);
    const map = new Map<string, {
      activas: number;
      esteMes: number;
      profit: number;
      demoras: number;
      clientes: Set<string>;
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
          esteMes: 0,
          profit: 0,
          demoras: 0,
          clientes: new Set(),
          creadosPorMes,
          llegadosPorMes,
        });
      }
      return map.get(op)!;
    };

    embarquesConEstado.forEach((e) => {
      const op = e.operador || "Sin Asignar";
      const d = getOrCreate(op);

      // Activas
      if (!ESTADOS_TERMINALES.includes(e.estadoReal)) {
        d.activas++;
        d.clientes.add(e.cliente_nombre);
      }

      // ETD este mes (usa etd como fecha principal, fallback a created_at)
      const fechaOperacion = e.etd ? new Date(e.etd + "T00:00:00") : new Date(e.created_at);
      if (isWithinInterval(fechaOperacion, { start: inicioMes, end: finMes })) {
        d.esteMes++;
      }

      // Profit
      const venta = ventaMap[e.id] || 0;
      const costo = costoMap[e.id] || 0;
      if (venta > 0 || costo > 0) {
        d.profit += calcularUtilidad(venta, costo);
      }

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
      .map(([nombre, d]) => ({
        nombre,
        cargasActivas: d.activas,
        cargasEsteMes: d.esteMes,
        profit: d.profit,
        demoras: d.demoras,
        clientes: Array.from(d.clientes),
        historicoCreadosPorMes: meses6.map((m) => ({ mes: m.label, valor: d.creadosPorMes[m.label] })),
        historicoLlegadosPorMes: meses6.map((m) => ({ mes: m.label, valor: d.llegadosPorMes[m.label] })),
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [embarquesConEstado, ventaMap, costoMap, meses6]);

  // Global
  const global = useMemo<OperacionesGlobal>(() => {
    const hoy = new Date();
    const inicioMes = startOfMonth(hoy);
    const finMes = endOfMonth(hoy);

    const totalActivas = operadores.reduce((s, o) => s + o.cargasActivas, 0);
    const totalEsteMes = operadores.reduce((s, o) => s + o.cargasEsteMes, 0);
    const totalProfit = operadores.reduce((s, o) => s + o.profit, 0);
    const totalDemoras = operadores.reduce((s, o) => s + o.demoras, 0);

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

    return {
      totalActivas,
      totalEsteMes,
      totalProfit,
      totalDemoras,
      activasHoy: activos.length,
      historicoCreadosPorMes: historico,
      creadasEsteMes: ultimoMes?.creadas || 0,
      llegadasEsteMes: ultimoMes?.llegadas || 0,
    };
  }, [operadores, activos, meses6]);

  return {
    isLoading,
    operadores,
    global,
    meses6Labels: meses6.map((m) => m.label),
  };
}
