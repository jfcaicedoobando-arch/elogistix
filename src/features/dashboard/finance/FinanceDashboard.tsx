import { useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useFinanceDashboard } from "@/features/dashboard/finance/hooks/useFinanceDashboard";
import { FinanceHeader } from "@/features/dashboard/finance/components/FinanceHeader";
import { HoyKpiRow } from "@/features/dashboard/finance/components/HoyKpiRow";
import { CobranzaBlock } from "@/features/dashboard/finance/components/CobranzaBlock";
import { PagosCajaBlock } from "@/features/dashboard/finance/components/PagosCajaBlock";
import { CierreAdminBlock } from "@/features/dashboard/finance/components/CierreAdminBlock";
import { formatFechaLarga } from "@/lib/formatters";
import { resolveDestinoPorPagar } from "@/features/dashboard/finance/destinoPorPagar";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { saludoMx } from "@/lib/ui/saludo";

function getSaludo(): string {
  return saludoMx();
}


function getHoyStr(): string {
  return formatFechaLarga(new Date());
}

function firstName(email: string | null | undefined, fallback: string): string {
  if (!email) return fallback;
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

type FinanceDash = ReturnType<typeof useFinanceDashboard>;

interface FinanceViewModel {
  vencidoMxn: number;
  vencidoUsd: number;
  porPagarMxn: number;
  porPagarUsd: number;
  porTimbrar: number;
  porCapturar: number;
}

function toViewModel(dash: FinanceDash): FinanceViewModel {
  const cob = dash.cobranzaKpis;
  const cxp = dash.cxpKpis;
  const adm = dash.pendientesAdmin;
  return {
    vencidoMxn: cob?.vencido_mxn ?? 0,
    vencidoUsd: cob?.vencido_usd ?? 0,
    porPagarMxn: cxp?.por_pagar_mxn ?? 0,
    porPagarUsd: cxp?.por_pagar_usd ?? 0,
    porTimbrar: dash.hueco.total,
    porCapturar: (adm?.entregadosCount ?? 0) + (adm?.eirCount ?? 0),
  };
}

export function FinanceDashboard() {
  const { user, effectiveRole } = useAuth();
  const dash = useFinanceDashboard();

  const { saludo, hoyStr } = useMemo(
    () => ({ saludo: getSaludo(), hoyStr: getHoyStr() }),
    [],
  );

  const nombre = firstName(user?.email, "");
  const vm = toViewModel(dash);

  // Si una fuente crítica (CxC/CxP/tesorería) falló, no renderizamos tarjetas:
  // un KPI en 0 se leería como cifra real. Una sola rama de error con retry.
  if (dash.isError) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <ErrorState
          title="No se pudieron cargar las cifras financieras"
          description={dash.error?.message ?? "Intenta de nuevo en unos segundos."}
          onRetry={dash.refetch}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <FinanceHeader
        saludo={saludo}
        nombre={nombre}
        hoyStr={hoyStr}
        vencidoMxn={vm.vencidoMxn}
        porPagarMxn={vm.porPagarMxn}
        porTimbrar={vm.porTimbrar}
      />

      <HoyKpiRow
        porFacturar={vm.porTimbrar}
        porPagarMxn={vm.porPagarMxn}
        porPagarUsd={vm.porPagarUsd}
        vencidoMxn={vm.vencidoMxn}
        vencidoUsd={vm.vencidoUsd}
        porCapturar={vm.porCapturar}
        porPagarTo={resolveDestinoPorPagar(effectiveRole)}
        loading={dash.isLoading}
      />

      <CobranzaBlock
        aging={dash.aging}
        facturasVencidas={dash.facturasVencidas}
        loading={dash.isLoading}
      />


      <PagosCajaBlock
        tesoreria={dash.tesoreria}
        cxpPorPagar={dash.cxpPorPagar}
        loading={dash.isLoading}
      />

      <CierreAdminBlock
        huecoTotal={dash.hueco.total}
        huecoMxn={dash.hueco.totalMxn}
        huecoUsd={dash.hueco.totalUsd}
        loading={dash.isLoading}
      />
    </div>
  );
}
