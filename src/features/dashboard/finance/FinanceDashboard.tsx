import { useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useFinanceDashboard } from "@/features/dashboard/finance/hooks/useFinanceDashboard";
import { FinanceHeader } from "@/features/dashboard/finance/components/FinanceHeader";
import { HoyKpiRow } from "@/features/dashboard/finance/components/HoyKpiRow";
import { CobranzaBlock } from "@/features/dashboard/finance/components/CobranzaBlock";
import { PagosCajaBlock } from "@/features/dashboard/finance/components/PagosCajaBlock";
import { CierreAdminBlock } from "@/features/dashboard/finance/components/CierreAdminBlock";

function getSaludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getHoyStr(): string {
  const fecha = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

function firstName(email: string | null | undefined, fallback: string): string {
  if (!email) return fallback;
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function FinanceDashboard() {
  const { user } = useAuth();
  const dash = useFinanceDashboard();

  const { saludo, hoyStr } = useMemo(
    () => ({ saludo: getSaludo(), hoyStr: getHoyStr() }),
    [],
  );

  const nombre = firstName(user?.email, "");

  const pendientesAdminCount =
    (dash.pendientesAdmin?.entregadosCount ?? 0) +
    (dash.pendientesAdmin?.eirCount ?? 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <FinanceHeader
        saludo={saludo}
        nombre={nombre}
        hoyStr={hoyStr}
        vencidoMxn={dash.cobranzaKpis?.vencido_mxn ?? 0}
        porPagarMxn={dash.cxpKpis?.por_pagar_mxn ?? 0}
        porTimbrar={dash.hueco.total}
      />

      <HoyKpiRow
        porFacturar={dash.hueco.total}
        porPagarMxn={dash.cxpKpis?.por_pagar_mxn ?? 0}
        porPagarUsd={dash.cxpKpis?.por_pagar_usd ?? 0}
        vencidoMxn={dash.cobranzaKpis?.vencido_mxn ?? 0}
        vencidoUsd={dash.cobranzaKpis?.vencido_usd ?? 0}
        porCapturar={pendientesAdminCount}
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
