import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmbarques, calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { ESTADOS_ACTIVOS } from "@/data/embarqueConstants";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────
export interface EmbarqueConEstado {
  id: string;
  expediente: string;
  cliente_nombre: string;
  modo: string;
  tipo: string;
  estado: string;
  estadoReal: string;
  etd: string | null;
  eta: string | null;
  operador: string;
  puerto_origen?: string | null;
  puerto_destino?: string | null;
  aeropuerto_origen?: string | null;
  aeropuerto_destino?: string | null;
  ciudad_origen?: string | null;
  ciudad_destino?: string | null;
  created_at: string;
}

export interface AlertaDemora extends EmbarqueConEstado {
  diasDemora: number;
  diasDesdeEta: number;
}

export interface ProximoArribo extends EmbarqueConEstado {
  diasRestantes: number;
}

export interface EmbarqueConProfit extends EmbarqueConEstado {
  ventaUSD: number;
  costoUSD: number;
  profit: number;
  margen: number;
}

export const ESTADOS_FILTRO = ESTADOS_ACTIVOS;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

const DIAS_LIBRES_DEFAULT = 7;

export function useDashboardData() {
  const { data: embarques = [], isLoading } = useEmbarques();
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro | null>(null);

  // Batch queries for profit
  const { data: ventasUSD = [] } = useQuery({
    queryKey: ["dashboard-ventas-usd"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conceptos_venta")
        .select("embarque_id, total")
        .eq("moneda", "USD");
      return data ?? [];
    },
  });

  const { data: costosUSD = [] } = useQuery({
    queryKey: ["dashboard-costos-usd"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conceptos_costo")
        .select("embarque_id, monto")
        .eq("moneda", "USD");
      return data ?? [];
    },
  });

  // ─── Derived data ──────────────────────────────────────
  const embarquesConEstado = useMemo<EmbarqueConEstado[]>(
    () =>
      embarques.map((e) => ({
        ...e,
        estadoReal: calcularEstadoEmbarque(e.modo, e.etd, e.eta, e.estado),
      })),
    [embarques]
  );

  const activos = useMemo(
    () =>
      embarquesConEstado.filter(
        (e) => !["Cerrado", "Cotización", "Cancelado"].includes(e.estadoReal)
      ),
    [embarquesConEstado]
  );

  const conteoPorEstado = useMemo(() => {
    const m: Record<EstadoFiltro, number> = {
      Confirmado: 0,
      "En Tránsito": 0,
      "En Aduana": 0,
      Entregado: 0,
    };
    activos.forEach((e) => {
      if (e.estadoReal in m) m[e.estadoReal as EstadoFiltro]++;
    });
    return m;
  }, [activos]);

  const totalActivos = useMemo(
    () => Object.values(conteoPorEstado).reduce((s, v) => s + v, 0),
    [conteoPorEstado]
  );

  // Alertas demora
  const alertasDemora = useMemo<AlertaDemora[]>(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return activos
      .filter((e) => e.estadoReal === "En Aduana" && e.eta)
      .map((e) => {
        const eta = new Date(e.eta! + "T00:00:00");
        const diasDesdeEta = Math.floor(
          (hoy.getTime() - eta.getTime()) / 864e5
        );
        const diasDemora = diasDesdeEta - DIAS_LIBRES_DEFAULT;
        return { ...e, diasDemora, diasDesdeEta };
      })
      .filter((e) => e.diasDemora >= 0)
      .sort((a, b) => b.diasDemora - a.diasDemora);
  }, [activos]);

  // Próximos arribos
  const proximosArribos = useMemo<ProximoArribo[]>(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return activos
      .filter((e) => e.estadoReal === "En Tránsito" && e.eta)
      .map((e) => {
        const eta = new Date(e.eta! + "T00:00:00");
        const diasRestantes = Math.ceil(
          (eta.getTime() - hoy.getTime()) / 864e5
        );
        return { ...e, diasRestantes };
      })
      .filter((e) => e.diasRestantes >= 0 && e.diasRestantes <= 7)
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [activos]);

  // Profit USD
  const profitPorEmbarque = useMemo<EmbarqueConProfit[]>(() => {
    const ventaMap: Record<string, number> = {};
    const costoMap: Record<string, number> = {};
    ventasUSD.forEach((v) => {
      ventaMap[v.embarque_id] =
        (ventaMap[v.embarque_id] || 0) + Number(v.total);
    });
    costosUSD.forEach((c) => {
      costoMap[c.embarque_id] =
        (costoMap[c.embarque_id] || 0) + Number(c.monto);
    });

    return activos
      .map((e) => {
        const venta = ventaMap[e.id] || 0;
        const costo = costoMap[e.id] || 0;
        const profit = venta - costo;
        const margen = venta !== 0 ? (profit / venta) * 100 : 0;
        return { ...e, ventaUSD: venta, costoUSD: costo, profit, margen };
      })
      .filter((e) => e.ventaUSD > 0 || e.costoUSD > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [activos, ventasUSD, costosUSD]);

  // Filtered list
  const embarquesFiltrados = useMemo(
    () =>
      filtroEstado
        ? activos.filter((e) => e.estadoReal === filtroEstado)
        : activos,
    [activos, filtroEstado]
  );

  return {
    isLoading,
    filtroEstado,
    setFiltroEstado,
    activos,
    conteoPorEstado,
    totalActivos,
    alertasDemora,
    proximosArribos,
    profitPorEmbarque,
    embarquesFiltrados,
  };
}
