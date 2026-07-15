import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, TrendingUp, Landmark, AlertTriangle, Receipt, Target } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { KPIsEjecutivos } from "@/features/dashboardEjecutivo/services";
import type { TopItem } from "@/features/tesoreria/services";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { KpiDrilldownSheet } from "./KpiDrilldownSheet";

interface Props {
  kpis: KPIsEjecutivos;
  /** Datos para drill-downs (Batch E). Si no se proveen, el KPI navega directo. */
  topDeudores?: TopItem[];
  topAcreedores?: TopItem[];
}

function formatDelta(pct: number): { text: string; variant: "positive" | "negative" | "neutral" } {
  if (!isFinite(pct) || pct === 0) return { text: "Sin cambio", variant: "neutral" };
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}% vs periodo anterior`,
    variant: pct > 0 ? "positive" : "negative",
  };
}

/**
 * Texto del delta para la card "Utilidad operativa": muestra margen del
 * periodo + variación en puntos porcentuales vs. mes anterior cuando exista
 * comparable (Fase I).
 */
function buildUtilidadDelta(kpis: KPIsEjecutivos): string {
  const margen = `Margen ${kpis.margen_pct.toFixed(1)}%`;
  if (kpis.margen_delta_puntos == null) return `${margen} · sin comparable previo`;
  const puntos = kpis.margen_delta_puntos;
  const signo = puntos > 0 ? "+" : "";
  return `${margen} · ${signo}${puntos.toFixed(1)}pp vs mes anterior`;
}

function utilidadVariant(kpis: KPIsEjecutivos): "positive" | "negative" | "neutral" {
  if (kpis.margen_delta_puntos != null && Math.abs(kpis.margen_delta_puntos) >= 0.5) {
    return kpis.margen_delta_puntos > 0 ? "positive" : "negative";
  }
  return kpis.margen_pct >= 0 ? "positive" : "negative";
}

export function BandaKPIs({ kpis, topDeudores, topAcreedores }: Props) {
  const nav = useNavigate();
  const [drill, setDrill] = useState<null | "deudores" | "acreedores">(null);
  const delta = formatDelta(kpis.ingresos_delta_pct);
  const cumplimiento = kpis.cumplimiento_presupuesto_pct;
  const sinPresupuesto = cumplimiento === 0;
  const cumplVariant: "positive" | "negative" | "neutral" = sinPresupuesto
    ? "neutral"
    : cumplimiento > 110
      ? "negative"
      : cumplimiento > 100
        ? "neutral"
        : "positive";
  const cumplDelta = sinPresupuesto
    ? "Sin presupuesto capturado"
    : cumplimiento > 110
      ? "Sobre el límite"
      : cumplimiento > 100
        ? "Cercano al límite"
        : "En rango";

  const puedeDrillDeudores = Array.isArray(topDeudores);
  const puedeDrillAcreedores = Array.isArray(topAcreedores);

  return (
    <>
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
          label="Utilidad operativa"
          value={formatCurrency(kpis.utilidad_mxn, "MXN")}
          delta={buildUtilidadDelta(kpis)}
          deltaVariant={utilidadVariant(kpis)}
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
          label="Cartera vencida (>30d)"
          value={formatCurrency(kpis.cartera_vencida_mxn, "MXN")}
          delta={`${kpis.cartera_vencida_count} cliente(s)`}
          deltaVariant={kpis.cartera_vencida_mxn > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          onClick={() => (puedeDrillDeudores ? setDrill("deudores") : nav("/facturacion"))}
        />
        <KpiCard
          label="CxP próx. 7 días"
          value={formatCurrency(kpis.cxp_7dias_mxn, "MXN")}
          icon={Receipt}
          onClick={() => (puedeDrillAcreedores ? setDrill("acreedores") : nav("/compras/facturas"))}
        />
        <KpiCard
          label="Cumplim. presupuesto"
          value={sinPresupuesto ? "—" : `${cumplimiento.toFixed(1)}%`}
          delta={cumplDelta}
          deltaVariant={cumplVariant}
          icon={Target}
          onClick={() => nav("/profit/presupuesto")}
        />
      </KpiStrip>

      {puedeDrillDeudores && (
        <KpiDrilldownSheet
          open={drill === "deudores"}
          onOpenChange={(v) => setDrill(v ? "deudores" : null)}
          title="Cartera vencida"
          description="Clientes con facturas vencidas hace más de 30 días."
          items={topDeudores ?? []}
          emptyText="Sin cartera vencida."
          verTodosHref="/facturacion"
          verTodosLabel="Ver cobranza completa"
          diasTone="vencido"
        />
      )}
      {puedeDrillAcreedores && (
        <KpiDrilldownSheet
          open={drill === "acreedores"}
          onOpenChange={(v) => setDrill(v ? "acreedores" : null)}
          title="CxP próximos 7 días"
          description="Facturas de proveedor que vencen en la próxima semana."
          items={topAcreedores ?? []}
          emptyText="Sin CxP pendiente."
          verTodosHref="/compras/facturas"
          verTodosLabel="Ver cuentas por pagar"
          diasTone="porVencer"
        />
      )}
    </>
  );
}
