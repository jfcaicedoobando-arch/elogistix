import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEmbarques, calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { ESTADOS_ACTIVOS } from "@/data/embarqueConstants";
import { calcularUtilidad, calcularMargen } from "@/lib/financialUtils";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useProfitMaps } from "@/hooks/useProfitMaps";

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

export interface EmbarqueMesSiguiente extends EmbarqueConProfit {
  facturado: boolean;
}

export interface ResumenFacturacion {
  totalEmbarques: number;
  ventaUSD: number;
  costoUSD: number;
  profitUSD: number;
  facturados: number;
  nombreMes: string;
}

export const ESTADOS_FILTRO = ESTADOS_ACTIVOS;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];

const DIAS_LIBRES_DEFAULT = 7;

export function useDashboardData() {
  const { data: embarques = [], isLoading } = useEmbarques();
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro | null>(null);
  const { ventaMap, costoMap } = useProfitMaps();

  // Query facturas para saber qué embarques ya tienen factura
  const { data: facturasRaw = [] } = useQuery({
    queryKey: queryKeys.dashboard.facturas,
    queryFn: async () => {
      const { data } = await supabase
        .from("facturas")
        .select("embarque_id, estado, total, moneda");
      return data ?? [];
    },
  });

  // ─── Derived data ──────────────────────────────────────
  const embarquesConEstado = useMemo<EmbarqueConEstado[]>(
    () =>
      embarques.map((e) => ({
        ...e,
        estadoReal: calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
      })),
    [embarques]
  );

  const activos = useMemo(
    () =>
      embarquesConEstado.filter(
        (e) => !["EIR", "Cerrado", "Cancelado"].includes(e.estadoReal)
      ),
    [embarquesConEstado]
  );

  const conteoPorEstado = useMemo(() => {
    const m: Record<EstadoFiltro, number> = {
      Confirmado: 0,
      "En Tránsito": 0,
      Arribo: 0,
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

  // Set de embarques que ya tienen factura
  const embarquesFacturados = useMemo(() => {
    const set = new Set<string>();
    facturasRaw.forEach((f) => set.add(f.embarque_id));
    return set;
  }, [facturasRaw]);

  // Alertas demora
  const alertasDemora = useMemo<AlertaDemora[]>(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return activos
      .filter((e) => e.estadoReal === "Arribo" && e.eta)
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

  // Profit USD (todos los activos con conceptos)
  const profitPorEmbarque = useMemo<EmbarqueConProfit[]>(() => {
    return activos
      .map((e) => {
        const venta = ventaMap[e.id] || 0;
        const costo = costoMap[e.id] || 0;
        const profit = calcularUtilidad(venta, costo);
        const margen = calcularMargen(venta, costo);
        return { ...e, ventaUSD: venta, costoUSD: costo, profit, margen };
      })
      .filter((e) => e.ventaUSD > 0 || e.costoUSD > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [activos, ventaMap, costoMap]);

  // Profit filtrado: solo embarques con ETA en el mes actual
  const profitArribosEsteMes = useMemo<EmbarqueConProfit[]>(() => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    return profitPorEmbarque.filter((e) => {
      if (!e.eta) return false;
      const eta = new Date(e.eta + "T00:00:00");
      return eta >= inicioMes && eta <= finMes;
    });
  }, [profitPorEmbarque]);

  // Embarques del mes siguiente con profit y estado de facturación
  const embarquesMesSiguiente = useMemo<EmbarqueMesSiguiente[]>(() => {
    const hoy = new Date();
    const inicioSig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const finSig = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);

    return embarquesConEstado
      .filter((e) => {
        if (!e.eta) return false;
        const eta = new Date(e.eta + "T00:00:00");
        return eta >= inicioSig && eta <= finSig;
      })
      .map((e) => {
        const venta = ventaMap[e.id] || 0;
        const costo = costoMap[e.id] || 0;
        const profit = calcularUtilidad(venta, costo);
        const margen = calcularMargen(venta, costo);
        const facturado = embarquesFacturados.has(e.id);
        return { ...e, ventaUSD: venta, costoUSD: costo, profit, margen, facturado };
      })
      .sort((a, b) => {
        const etaA = a.eta ? new Date(a.eta).getTime() : 0;
        const etaB = b.eta ? new Date(b.eta).getTime() : 0;
        return etaA - etaB;
      });
  }, [embarquesConEstado, ventaMap, costoMap, embarquesFacturados]);

  // Resumen de facturación del mes siguiente
  const resumenMesSiguiente = useMemo<ResumenFacturacion>(() => {
    const hoy = new Date();
    const mesSig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const nombreMes = mesSig.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

    const totalEmbarques = embarquesMesSiguiente.length;
    const ventaUSD = embarquesMesSiguiente.reduce((s, e) => s + e.ventaUSD, 0);
    const costoUSD = embarquesMesSiguiente.reduce((s, e) => s + e.costoUSD, 0);
    const profitUSD = embarquesMesSiguiente.reduce((s, e) => s + e.profit, 0);
    const facturados = embarquesMesSiguiente.filter((e) => e.facturado).length;

    return { totalEmbarques, ventaUSD, costoUSD, profitUSD, facturados, nombreMes };
  }, [embarquesMesSiguiente]);

  // Filtered list
  const embarquesFiltrados = useMemo(
    () =>
      filtroEstado
        ? activos.filter((e) => e.estadoReal === filtroEstado)
        : activos,
    [activos, filtroEstado]
  );

  // Arribos este mes
  const arribosEsteMes = useMemo(() => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const filtered = embarquesConEstado.filter((e) => {
      if (!e.eta) return false;
      const eta = new Date(e.eta + "T00:00:00");
      return eta >= inicioMes && eta <= finMes;
    });

    const yaLlegaron = filtered.filter((e) =>
      ["Arribo", "En Aduana", "Entregado", "EIR", "Cerrado"].includes(e.estadoReal)
    ).length;

    const enCamino = filtered.filter((e) =>
      ["Confirmado", "En Tránsito"].includes(e.estadoReal)
    ).length;

    const profitUSD = filtered.reduce((acc, e) => {
      const v = ventaMap[e.id] || 0;
      const c = costoMap[e.id] || 0;
      return acc + (v - c);
    }, 0);

    return { total: filtered.length, yaLlegaron, enCamino, profitUSD };
  }, [embarquesConEstado, ventaMap, costoMap]);

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
    profitArribosEsteMes,
    embarquesFiltrados,
    arribosEsteMes,
    embarquesMesSiguiente,
    resumenMesSiguiente,
  };
}
