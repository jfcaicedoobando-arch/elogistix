/**
 * Compose hooks for the unified finance dashboard.
 * Reusa hooks ya existentes — sin RPCs nuevas.
 */
import { useMemo } from "react";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useResumenTesoreria } from "@/features/tesoreria/hooks";
import { useDashboardEjecutivoFacturacion } from "@/features/facturacion/hooks/useDashboardEjecutivoFacturacion";
import { useHuecoFacturacion } from "@/features/facturacion/hooks/useHuecoFacturacion";
import { useEmbarquesPendientesAdmin } from "@/features/dashboard/hooks/useEmbarquesPendientesAdmin";
import { esFacturaPorPagar } from "@/features/cxp/services/cxpPorPagarFiltro";

export interface AgingBuckets {
  b0_15: number;
  b16_30: number;
  b31_60: number;
  b61_90: number;
  b90plus: number;
}

const EMPTY_AGING: AgingBuckets = {
  b0_15: 0,
  b16_30: 0,
  b31_60: 0,
  b61_90: 0,
  b90plus: 0,
};

export function useFinanceDashboard() {
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const tesoreriaQ = useResumenTesoreria();
  const ejecutivoQ = useDashboardEjecutivoFacturacion();
  const huecoQ = useHuecoFacturacion();
  const pendientesAdminQ = useEmbarquesPendientesAdmin(true);

  const facturasVencidas = useMemo(() => {
    const filas = (cobranzaQ.data ?? []).filter(
      (f) => f.saldo > 0 && f.estatus_cobranza === "Vencida",
    );
    return filas
      .slice()
      .sort((a, b) => b.dias_vencido - a.dias_vencido)
      .slice(0, 10);
  }, [cobranzaQ.data]);

  const cxpPorPagar = useMemo(() => {
    // Mismo criterio que el KPI "Por pagar 30d" (Q-15.6): incluye "Por
    // aprobar" para no anunciar "Nada por pagar" cuando sí hay saldo pendiente.
    const filas = (cxpQ.data ?? []).filter(esFacturaPorPagar);
    return filas
      .slice()
      .sort((a, b) => (a.fecha_vencimiento ?? "9999").localeCompare(b.fecha_vencimiento ?? "9999"))
      .slice(0, 10);
  }, [cxpQ.data]);

  const aging = useMemo<AgingBuckets>(() => {
    const acc = { ...EMPTY_AGING };
    for (const f of cobranzaQ.data ?? []) {
      if (f.saldo <= 0) continue;
      const dv = f.dias_vencido;
      if (dv <= 0) continue;
      if (dv <= 15) acc.b0_15 += f.saldo;
      else if (dv <= 30) acc.b16_30 += f.saldo;
      else if (dv <= 60) acc.b31_60 += f.saldo;
      else if (dv <= 90) acc.b61_90 += f.saldo;
      else acc.b90plus += f.saldo;
    }
    return acc;
  }, [cobranzaQ.data]);

  const isLoading =
    cobranzaQ.isLoading ||
    cxpQ.isLoading ||
    tesoreriaQ.isLoading ||
    ejecutivoQ.isLoading ||
    huecoQ.isLoading;

  return {
    isLoading,
    cobranzaKpis: cobranzaQ.kpis,
    cxpKpis: cxpQ.kpis,
    tesoreria: tesoreriaQ.data,
    ejecutivo: ejecutivoQ.data,
    hueco: { total: huecoQ.totalEmbarques, totalUsd: huecoQ.totalUsd, totalMxn: huecoQ.totalMxn },
    pendientesAdmin: pendientesAdminQ.data,
    facturasVencidas,
    cxpPorPagar,
    aging,
  };
}
