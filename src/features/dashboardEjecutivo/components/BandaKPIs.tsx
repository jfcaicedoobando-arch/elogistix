import type { FuenteEERR } from "@/features/profit/hooks/useFuenteEerr";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DollarSign, TrendingUp, Landmark, AlertTriangle, Receipt, Target } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatNumber, formatPercent} from "@/lib/formatters/numbers";
import type { KPIsEjecutivos } from "@/features/dashboardEjecutivo/services";
import type { TopVencimiento } from "../domain/vencimientos";
import { cumplimientoDisplay, puedeVerExcesos } from "./cumplimientoDisplay";
import { importeEjecutivo } from "./kpiValuacion";
import type { ResumenVsReal } from "@/features/presupuesto/services";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { KpiDrilldownSheet } from "./KpiDrilldownSheet";
import { BudgetOverrunSheet } from "@/features/profit/components/BudgetOverrunSheet";
import { presupuestoVsRealHref } from "@/features/presupuesto";

interface Props {
  kpis: KPIsEjecutivos;
  periodo: string;
  fuente: FuenteEERR;
  /** Datos para drill-downs (Batch E). Si no se proveen, el KPI navega directo. */
  topDeudores?: TopVencimiento[];
  topAcreedores?: TopVencimiento[];
  deudoresSinValuar?: TopVencimiento[];
  acreedoresSinValuar?: TopVencimiento[];
  /** Fase J: resumen presupuesto para drilldown de "Cumplim. presupuesto". */
  presupuesto?: ResumenVsReal;
}

/**
 * Umbral por debajo del cual una variación se considera ruido y no se pinta
 * con color (evita el "+0.0% vs periodo anterior" alarmante).
 */
const EPS_PCT = 0.05;
const EPS_PP = 0.05;

function formatDelta(pct: number | null): { text: string; variant: "positive" | "negative" | "neutral" } {
  if (pct == null) return { text: "Sin comparable previo", variant: "neutral" };
  if (!isFinite(pct) || Math.abs(pct) < EPS_PCT) return { text: "Sin variación vs. mes anterior", variant: "neutral" };
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${formatPercent(pct, 1)} vs periodo anterior`,
    variant: pct > 0 ? "positive" : "negative",
  };
}

/**
 * Texto del delta para la card "Utilidad operativa": muestra margen del
 * periodo + variación en puntos porcentuales vs. mes anterior cuando exista
 * comparable (Fase I). Fase I fix #1: umbral EPS_PP evita "+0.0pp" ruidoso.
 */
function buildUtilidadDelta(kpis: KPIsEjecutivos): string {
  if (kpis.eerr_incompleto) return "Margen no disponible · valuación incompleta";
  if (kpis.ingresos_mxn === 0) return "Margen no calculable · ingresos en cero";
  const margen = `Margen ${formatPercent(kpis.margen_pct, 1)}`;
  if (kpis.margen_delta_puntos == null) return `${margen} · sin comparable previo`;
  const puntos = kpis.margen_delta_puntos;
  if (Math.abs(puntos) < EPS_PP) return `${margen} · sin variación vs mes anterior`;
  const signo = puntos > 0 ? "+" : "";
  return `${margen} · ${signo}${formatNumber(puntos, { decimals: 1 })} pp vs mes anterior`;
}

function utilidadVariant(kpis: KPIsEjecutivos): "positive" | "negative" | "neutral" {
  if (kpis.eerr_incompleto || kpis.ingresos_mxn === 0) return "neutral";
  if (kpis.margen_delta_puntos != null && Math.abs(kpis.margen_delta_puntos) >= 0.5) {
    return kpis.margen_delta_puntos > 0 ? "positive" : "negative";
  }
  return kpis.margen_pct >= 0 ? "positive" : "negative";
}

export function BandaKPIs({ kpis, periodo, fuente, topDeudores, topAcreedores, presupuesto, deudoresSinValuar, acreedoresSinValuar }: Props) {
  const nav = useNavigate();
  const detalleHref = `/profit/estado-resultados?${new URLSearchParams({ mes: periodo, fuente })}`;
  const [drill, setDrill] = useState<null | "deudores" | "acreedores" | "presupuesto">(null);
  const delta = formatDelta(kpis.ingresos_delta_pct);
  const cumpl = cumplimientoDisplay(kpis, presupuesto);

  const puedeDrillDeudores = Array.isArray(topDeudores);
  const puedeDrillAcreedores = Array.isArray(topAcreedores);
  const puedeDrillPresupuesto = puedeVerExcesos(kpis, presupuesto);

  return (
    <>
      <KpiStrip desktopCols={4}>
        <KpiCard
          label="Ingresos del periodo"
          value={importeEjecutivo(kpis.ingresos_mxn, kpis.eerr_incompleto)}
          delta={kpis.eerr_incompleto ? "Valuación incompleta" : delta.text}
          deltaVariant={kpis.eerr_incompleto ? "neutral" : delta.variant}
          icon={DollarSign}
          onClick={() => nav(detalleHref)}
        />
        <KpiCard
          label="Utilidad operativa"
          value={importeEjecutivo(kpis.utilidad_mxn, kpis.eerr_incompleto)}
          delta={buildUtilidadDelta(kpis)}
          deltaVariant={utilidadVariant(kpis)}
          icon={TrendingUp}
          onClick={() => nav(detalleHref)}
        />
        <KpiCard
          label="Saldo en bancos"
          value={importeEjecutivo(kpis.saldo_bancos_mxn, kpis.saldo_bancos_incompleto)}
          delta={kpis.saldo_bancos_incompleto ? "Valuación incompleta · ver saldos nominales" : undefined}
          icon={Landmark}
          onClick={() => nav("/tesoreria")}
        />
        <KpiCard
          label="Cobranza vencida (>30d)"
          value={importeEjecutivo(kpis.cartera_vencida_mxn, kpis.cartera_vencida_incompleta)}
          delta={kpis.cartera_vencida_incompleta ? "Valuación incompleta · ver detalle" : `${kpis.cartera_vencida_count} cliente(s)`}
          deltaVariant={!kpis.cartera_vencida_incompleta && kpis.cartera_vencida_mxn > 0 ? "negative" : "neutral"}
          icon={AlertTriangle}
          onClick={() => (puedeDrillDeudores ? setDrill("deudores") : nav("/facturacion"))}
        />
        <KpiCard
          label="CxP próx. 7 días"
          value={importeEjecutivo(kpis.cxp_7dias_mxn, kpis.cxp_7dias_incompleto)}
          delta={kpis.cxp_7dias_incompleto ? "Valuación incompleta · ver detalle" : undefined}
          icon={Receipt}
          onClick={() => (puedeDrillAcreedores ? setDrill("acreedores") : nav("/compras/facturas"))}
        />
        <KpiCard
          label="Cumplim. presupuesto"
          value={cumpl.value}
          delta={cumpl.delta}
          deltaVariant={cumpl.variant}
          icon={Target}
          onClick={() => (puedeDrillPresupuesto ? setDrill("presupuesto") : nav(presupuestoVsRealHref(presupuesto?.periodo)))}
        />
      </KpiStrip>

      {puedeDrillDeudores && (
        <KpiDrilldownSheet
          open={drill === "deudores"}
          onOpenChange={(v) => setDrill(v ? "deudores" : null)}
          title="Cobranza vencida (>30d)"
          description="Clientes con facturas vencidas hace más de 30 días."
          items={topDeudores ?? []}
          sinValuar={deudoresSinValuar}
          emptyText="Sin cartera vencida hace más de 30 días."
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
          description="Facturas de proveedor con saldo que vencen desde hoy hasta dentro de 7 días, inclusive."
          items={topAcreedores ?? []}
          sinValuar={acreedoresSinValuar}
          emptyText="Sin CxP con vencimiento en los próximos 7 días."
          verTodosHref="/compras/facturas"
          verTodosLabel="Ver cuentas por pagar"
          diasTone="porVencer"
        />
      )}
      {puedeDrillPresupuesto && presupuesto && (
        <BudgetOverrunSheet
          open={drill === "presupuesto"}
          onOpenChange={(v) => setDrill(v ? "presupuesto" : null)}
          filas={presupuesto.top_exceso}
          periodo={presupuesto.periodo}
        />
      )}
    </>
  );
}
