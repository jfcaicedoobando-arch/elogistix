import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DollarSign, TrendingUp, Landmark, AlertTriangle, Receipt, Target } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { KPIsEjecutivos } from "@/features/dashboardEjecutivo/services";
import type { TopItem } from "@/features/tesoreria/services";
import type { ResumenVsReal } from "@/features/presupuesto/services";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { KpiDrilldownSheet } from "./KpiDrilldownSheet";
import { BudgetOverrunSheet } from "@/features/profit/components/BudgetOverrunSheet";

interface Props {
  kpis: KPIsEjecutivos;
  /** Datos para drill-downs (Batch E). Si no se proveen, el KPI navega directo. */
  topDeudores?: TopItem[];
  topAcreedores?: TopItem[];
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
    text: `${sign}${pct.toFixed(1)}% vs periodo anterior`,
    variant: pct > 0 ? "positive" : "negative",
  };
}

/**
 * Texto del delta para la card "Utilidad operativa": muestra margen del
 * periodo + variación en puntos porcentuales vs. mes anterior cuando exista
 * comparable (Fase I). Fase I fix #1: umbral EPS_PP evita "+0.0pp" ruidoso.
 */
function buildUtilidadDelta(kpis: KPIsEjecutivos): string {
  const margen = `Margen ${kpis.margen_pct.toFixed(1)}%`;
  if (kpis.margen_delta_puntos == null) return `${margen} · sin comparable previo`;
  const puntos = kpis.margen_delta_puntos;
  if (Math.abs(puntos) < EPS_PP) return `${margen} · sin variación vs mes anterior`;
  const signo = puntos > 0 ? "+" : "";
  return `${margen} · ${signo}${puntos.toFixed(1)}pp vs mes anterior`;
}

function utilidadVariant(kpis: KPIsEjecutivos): "positive" | "negative" | "neutral" {
  if (kpis.margen_delta_puntos != null && Math.abs(kpis.margen_delta_puntos) >= 0.5) {
    return kpis.margen_delta_puntos > 0 ? "positive" : "negative";
  }
  return kpis.margen_pct >= 0 ? "positive" : "negative";
}

/**
 * Deriva variant + texto para la KPI "Cumplim. presupuesto". Extraído del
 * componente para bajar la complejidad ciclomática (regla ESLint ≤16).
 */
function buildCumplimientoDisplay(
  cumplimiento: number,
  excesos: number,
): { variant: "positive" | "negative" | "neutral"; delta: string; sinPresupuesto: boolean } {
  const sinPresupuesto = cumplimiento === 0;
  if (sinPresupuesto) return { variant: "neutral", delta: "Sin presupuesto capturado", sinPresupuesto };
  if (excesos > 0) return { variant: "negative", delta: `${excesos} categoría(s) en exceso`, sinPresupuesto };
  if (cumplimiento > 100) return { variant: "neutral", delta: "Cercano al límite", sinPresupuesto };
  return { variant: "positive", delta: "En rango", sinPresupuesto };
}

export function BandaKPIs({ kpis, topDeudores, topAcreedores, presupuesto }: Props) {
  const nav = useNavigate();
  const [drill, setDrill] = useState<null | "deudores" | "acreedores" | "presupuesto">(null);
  const delta = formatDelta(kpis.ingresos_delta_pct);
  const cumplimiento = kpis.cumplimiento_presupuesto_pct;
  const excesos = kpis.categorias_en_exceso ?? 0;
  const cumpl = buildCumplimientoDisplay(cumplimiento, excesos);
  const { sinPresupuesto } = cumpl;

  const puedeDrillDeudores = Array.isArray(topDeudores);
  const puedeDrillAcreedores = Array.isArray(topAcreedores);
  const puedeDrillPresupuesto = !!presupuesto && excesos > 0;

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
          delta={cumpl.delta}
          deltaVariant={cumpl.variant}
          icon={Target}
          onClick={() => (puedeDrillPresupuesto ? setDrill("presupuesto") : nav("/profit/presupuesto"))}
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
