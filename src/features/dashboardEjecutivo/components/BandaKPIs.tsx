import { useNavigate } from "react-router-dom";
import { DollarSign, TrendingUp, Landmark, AlertTriangle, Receipt, Target } from "lucide-react";
import { KpiCard } from "./KpiCard";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { KPIsEjecutivos } from "@/features/dashboardEjecutivo/services";
import { KpiStrip } from "@/components/shared/KpiStrip";

interface Props {
  kpis: KPIsEjecutivos;
}

function formatDelta(pct: number): { text: string; variant: "positive" | "negative" | "neutral" } {
  if (!isFinite(pct) || pct === 0) return { text: "Sin cambio", variant: "neutral" };
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}% vs periodo anterior`,
    variant: pct > 0 ? "positive" : "negative",
  };
}

export function BandaKPIs({ kpis }: Props) {
  const nav = useNavigate();
  const delta = formatDelta(kpis.ingresos_delta_pct);
  const cumplimiento = kpis.cumplimiento_presupuesto_pct;
  const cumplVariant: "positive" | "negative" | "neutral" =
    cumplimiento === 0 ? "neutral" : cumplimiento > 110 ? "negative" : cumplimiento > 100 ? "neutral" : "positive";

  return (
    <KpiStrip desktopCols={6}>
      <KpiCard
        label="Ingresos del periodo"
        value={formatCurrency(kpis.ingresos_mxn, "MXN")}
        delta={delta.text}
        deltaVariant={delta.variant}
        icon={DollarSign}
        onClick={() => nav("/profit/estado-resultados")}
      />
      <KpiCard
        label="Utilidad neta"
        value={formatCurrency(kpis.utilidad_mxn, "MXN")}
        delta={`Margen ${kpis.margen_pct.toFixed(1)}%`}
        deltaVariant={kpis.margen_pct >= 0 ? "positive" : "negative"}
        icon={TrendingUp}
        onClick={() => nav("/profit/estado-resultados")}
      />
      <KpiCard
        label="Saldo en bancos"
        value={formatCurrency(kpis.saldo_bancos_mxn, "MXN")}
        icon={Landmark}
        onClick={() => nav("/tesoreria")}
      />
      <KpiCard
        label="Cartera vencida"
        value={formatCurrency(kpis.cartera_vencida_mxn, "MXN")}
        delta={`${kpis.cartera_vencida_count} cliente(s)`}
        deltaVariant={kpis.cartera_vencida_mxn > 0 ? "negative" : "neutral"}
        icon={AlertTriangle}
        onClick={() => nav("/facturacion")}
      />
      <KpiCard
        label="CxP próx. 7 días"
        value={formatCurrency(kpis.cxp_7dias_mxn, "MXN")}
        icon={Receipt}
        onClick={() => nav("/cxp")}
      />
      <KpiCard
        label="Cumplim. presupuesto"
        value={`${cumplimiento.toFixed(1)}%`}
        delta={cumplimiento > 110 ? "Sobre el límite" : cumplimiento > 100 ? "Cercano al límite" : "En rango"}
        deltaVariant={cumplVariant}
        icon={Target}
        onClick={() => nav("/profit/presupuesto")}
      />
    </KpiStrip>
  );
}
