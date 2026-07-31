/**
 * Cómputos derivados para el dashboard del portal cliente.
 * Extraído de PortalDashboard para separar lógica de render.
 *
 * B-068/B-076: los KPIs de facturación pendiente YA NO se calculan aquí.
 * El dashboard usa `useEstadoCuenta` — la misma fuente que el estado de
 * cuenta del portal (saldo por moneda, incluye Parcialmente pagada y resta
 * pagos + notas de crédito).
 */
import { useMemo } from "react";
import { isAfter, addDays } from "date-fns";
import { parseDateOnlyLocal } from "@/lib/date/dateOnly";
import { calcularEstadoEmbarque } from "@/features/embarques/domain/embarque";
import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";

interface EmbarqueLike {
  id: string;
  modo: string;
  tipo: string;
  etd: string | null;
  eta: string | null;
  estado: string;
}

export function usePortalDashboardKpis<E extends EmbarqueLike>(embarques: E[]) {
  const embarquesActivos = useMemo(
    () => embarques.filter((e) => !["Cerrado", "Cancelado", "EIR", "Por liquidar"].includes(e.estado)),
    [embarques],
  );

  const proximosArribos = useMemo(() => {
    const hoy = new Date();
    const en14Dias = addDays(hoy, 14);
    return embarquesActivos
      .filter((e) => {
        if (!e.eta) return false;
        try {
          // B-089: la ETA es date-only; parsear como medianoche LOCAL (no UTC).
          const etaDate = parseDateOnlyLocal(e.eta);
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

  return {
    embarquesActivos,
    proximosArribos,
    estadoDistribucion,
  };
}
