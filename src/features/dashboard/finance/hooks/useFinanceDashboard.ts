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
import { esFacturaPorPagar } from "@/features/cxp/services";
import { esCxcVencida } from "@/lib/domain/vencimiento";
import { resumirAgingMxn, type ResumenAgingMxn } from "@/features/dashboard/finance/domain/carteraAging";

export function useFinanceDashboard() {
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const tesoreriaQ = useResumenTesoreria();
  const ejecutivoQ = useDashboardEjecutivoFacturacion();
  const huecoQ = useHuecoFacturacion();
  const pendientesAdminQ = useEmbarquesPendientesAdmin(true);

  const facturasVencidas = useMemo(() => {
    const filas = (cobranzaQ.data ?? []).filter(esCxcVencida);
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

  // El aging se calcula en el canon compartido (`resumirAgingMxn`): mismos
  // cortes y misma conversión a MXN que `/cobranza/aging` y `/reportes/cartera`.
  const aging = useMemo<ResumenAgingMxn>(
    () => resumirAgingMxn(cobranzaQ.data ?? []),
    [cobranzaQ.data],
  );


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
