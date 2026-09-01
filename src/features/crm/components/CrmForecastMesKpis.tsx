/**
 * Forecast del mes en KPIs, una tira por moneda.
 * P1-5: nunca se suman monedas distintas ni se etiquetan como MXN.
 */
import { Target, TrendingUp, Trophy } from "lucide-react";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { useForecast } from "@/features/crm/hooks";
import { CrmStatStripItem } from "./CrmStatStripItem";

const STRIP_CLASS =
  "sm:border sm:rounded-md sm:bg-card sm:overflow-hidden sm:gap-0";

function TiraPlaceholder({ valor }: { valor: string }) {
  return (
    <KpiStrip desktopCols={3} className={STRIP_CLASS}>
      <CrmStatStripItem icon={TrendingUp} label="Pipeline" value={valor} />
      <CrmStatStripItem icon={Target} label="Ponderado" value={valor} />
      <CrmStatStripItem icon={Trophy} label="Ganado" value={valor} />
    </KpiStrip>
  );
}

export function CrmForecastMesKpis() {
  const { data: forecast, isLoading } = useForecast();
  const totalesPorMoneda = forecast?.totalesPorMoneda ?? [];

  return (
    <section className="space-y-2">
      <SectionHeading as="h2" variant="overline">
        Forecast del mes
      </SectionHeading>
      {isLoading ? (
        <TiraPlaceholder valor="…" />
      ) : totalesPorMoneda.length === 0 ? (
        <TiraPlaceholder valor={formatCurrencyCompact(0, "MXN")} />
      ) : (
        totalesPorMoneda.map((t) => (
          <KpiStrip key={t.moneda} desktopCols={3} className={STRIP_CLASS}>
            <CrmStatStripItem
              icon={TrendingUp}
              label={`Pipeline (${t.moneda})`}
              value={formatCurrencyCompact(t.totalPipeline, t.moneda)}
              valueTooltip={formatCurrency(t.totalPipeline, t.moneda)}
            />
            <CrmStatStripItem
              icon={Target}
              label={`Ponderado (${t.moneda})`}
              value={formatCurrencyCompact(t.totalPonderado, t.moneda)}
              valueTooltip={formatCurrency(t.totalPonderado, t.moneda)}
            />
            <CrmStatStripItem
              icon={Trophy}
              label={`Ganado (${t.moneda})`}
              value={formatCurrencyCompact(t.totalGanado, t.moneda)}
              valueTooltip={formatCurrency(t.totalGanado, t.moneda)}
            />
          </KpiStrip>
        ))
      )}
    </section>
  );
}

export default CrmForecastMesKpis;
