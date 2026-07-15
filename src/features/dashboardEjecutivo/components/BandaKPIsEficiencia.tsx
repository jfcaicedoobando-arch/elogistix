/**
 * Fase 4 UI/UX — Tira de KPIs financieros derivados: DSO, DPO y Runway.
 *
 * DSO/DPO expresan eficiencia de cobro y pago; Runway indica cuántos meses de
 * operación aguantan los bancos si el mes cierra en pérdida. Complementan la
 * `BandaKPIs` (que muestra ingresos/utilidad/saldos) con métricas de solvencia.
 */
import { Clock, Hourglass, Waves } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { KpiStrip } from "@/components/shared/KpiStrip";
import type { KPIsEjecutivos } from "@/features/dashboardEjecutivo/services";

interface Props {
  kpis: KPIsEjecutivos;
}

function fmtDias(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(0)} días`;
}

function dsoVariant(n: number | null): "positive" | "negative" | "neutral" {
  if (n == null) return "neutral";
  if (n <= 30) return "positive";
  if (n <= 60) return "neutral";
  return "negative";
}

function dpoVariant(n: number | null): "positive" | "negative" | "neutral" {
  // DPO alto = pagamos más tarde = mejor caja. DPO muy bajo = descapitalización.
  if (n == null) return "neutral";
  if (n >= 45) return "positive";
  if (n >= 20) return "neutral";
  return "negative";
}

function runwayVariant(n: number | null): "positive" | "negative" | "neutral" {
  if (n == null) return "positive"; // sin burn = utilidad ≥ 0
  if (n >= 6) return "neutral";
  if (n >= 3) return "negative";
  return "negative";
}

function runwayValue(n: number | null): string {
  if (n == null) return "Sin burn";
  if (n < 1) return "< 1 mes";
  return `${n.toFixed(1)} meses`;
}

export function BandaKPIsEficiencia({ kpis }: Props) {
  return (
    <KpiStrip desktopCols={3}>
      <KpiCard
        label="DSO — Días de cobro"
        value={fmtDias(kpis.dso_dias)}
        delta={kpis.dso_dias == null ? "Sin ingresos en el periodo" : "CxC 30d ÷ ingresos × 30"}
        deltaVariant={dsoVariant(kpis.dso_dias)}
        icon={Clock}
      />
      <KpiCard
        label="DPO — Días de pago"
        value={fmtDias(kpis.dpo_dias)}
        delta={kpis.dpo_dias == null ? "Sin costos en el periodo" : "CxP 30d ÷ costos × 30"}
        deltaVariant={dpoVariant(kpis.dpo_dias)}
        icon={Hourglass}
      />
      <KpiCard
        label="Runway financiero"
        value={runwayValue(kpis.runway_meses)}
        delta={kpis.runway_meses == null ? "Utilidad ≥ 0 en el mes" : "Bancos ÷ (costos − ingresos)"}
        deltaVariant={runwayVariant(kpis.runway_meses)}
        icon={Waves}
      />
    </KpiStrip>
  );
}
