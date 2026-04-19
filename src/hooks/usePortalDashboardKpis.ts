/**
 * Cómputos derivados para el dashboard del portal cliente.
 * Extraído de PortalDashboard para separar lógica de render.
 */
import { useMemo } from "react";
import { parseISO, isAfter, addDays } from "date-fns";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";
import { ESTADOS_EMBARQUE } from "@/constants/embarqueConstants";

interface EmbarqueLike {
  id: string;
  modo: string;
  tipo: string;
  etd: string | null;
  eta: string | null;
  estado: string;
}

interface FacturaLike {
  estado: string;
  total: number;
}

export function usePortalDashboardKpis<E extends EmbarqueLike, F extends FacturaLike>(
  embarques: E[],
  facturas: F[],
) {
  const embarquesActivos = useMemo(
    () => embarques.filter((e) => !["Cerrado", "Cancelado", "EIR"].includes(e.estado)),
    [embarques],
  );

  const facturasPendientes = useMemo(
    () => facturas.filter((f) => f.estado === "Emitida" || f.estado === "Vencida"),
    [facturas],
  );

  const proximosArribos = useMemo(() => {
    const hoy = new Date();
    const en14Dias = addDays(hoy, 14);
    return embarquesActivos
      .filter((e) => {
        if (!e.eta) return false;
        try {
          const etaDate = parseISO(e.eta);
          return isAfter(etaDate, hoy) && !isAfter(etaDate, en14Dias);
        } catch { return false; }
      })
      .sort((a, b) => (a.eta! > b.eta! ? 1 : -1))
      .slice(0, 5);
  }, [embarquesActivos]);

  const estadoDistribucion = useMemo(() => {
    const counts: Record<string, number> = {};
    embarquesActivos.forEach((e) => {
      const est = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      counts[est] = (counts[est] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => {
      const idxA = (ESTADOS_EMBARQUE as readonly string[]).indexOf(a[0]);
      const idxB = (ESTADOS_EMBARQUE as readonly string[]).indexOf(b[0]);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
  }, [embarquesActivos]);

  const montoFacturasPendientes = useMemo(
    () => facturasPendientes.reduce((sum, f) => sum + f.total, 0),
    [facturasPendientes],
  );

  const facturasVencidas = useMemo(
    () => facturasPendientes.filter((f) => f.estado === "Vencida").length,
    [facturasPendientes],
  );

  return {
    embarquesActivos,
    facturasPendientes,
    proximosArribos,
    estadoDistribucion,
    montoFacturasPendientes,
    facturasVencidas,
  };
}
