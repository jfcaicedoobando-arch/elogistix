/**
 * Proyección de ventas del mes en KPIs, una tira por moneda.
 * P1-5: nunca se suman monedas distintas ni se etiquetan como MXN.
 */
import { Target, TrendingUp, Trophy } from "lucide-react";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { useForecast } from "@/features/crm/hooks";
import { primerDiaMesMx, ultimoDiaMesMx } from "@/lib/date/mx";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { CrmStatStripItem } from "./CrmStatStripItem";

const STRIP_CLASS =
  "sm:border sm:rounded-md sm:bg-card sm:overflow-hidden sm:gap-0";

function TiraPlaceholder({ valor }: { valor: string }) {
  return (
    <KpiStrip desktopCols={3} className={STRIP_CLASS}>
      <CrmStatStripItem icon={TrendingUp} label="Oportunidades abiertas" value={valor} />
      <CrmStatStripItem icon={Target} label="Valor ponderado" value={valor} />
      <CrmStatStripItem icon={Trophy} label="Ganado" value={valor} />
    </KpiStrip>
  );
}

export function CrmForecastMesKpis() {
  // FIX-8 (auditoría): "Proyección de ventas del mes" es SOLO el mes en curso, calendario MX.
  const { data: forecast, isLoading, isError, refetch } = useForecast(primerDiaMesMx(0), ultimoDiaMesMx(0));
  const totalesPorMoneda = forecast?.totalesPorMoneda ?? [];

  return (
    <section className="space-y-2">
      <SectionHeading as="h2" variant="overline">
        Proyección de ventas del mes
      </SectionHeading>
      <p className="text-body-sm text-muted-foreground">Oportunidades abiertas: importe estimado. Valor ponderado: importe × probabilidad de cierre, sin sumar monedas distintas.</p>
      {isError ? (
        <ErrorStateInline message="No se pudo cargar la proyección de ventas del mes." onRetry={() => void refetch()} />
      ) : isLoading ? (
        <TiraPlaceholder valor="…" />
      ) : totalesPorMoneda.length === 0 ? (
        <TiraPlaceholder valor={formatCurrencyCompact(0, "MXN")} />
      ) : (
        totalesPorMoneda.map((t) => (
          <KpiStrip key={t.moneda} desktopCols={3} className={STRIP_CLASS}>
            <CrmStatStripItem
              icon={TrendingUp}
              label={`Oportunidades abiertas (${t.moneda})`}
              value={formatCurrencyCompact(t.totalPipeline, t.moneda)}
              valueTooltip={formatCurrency(t.totalPipeline, t.moneda)}
            />
            <CrmStatStripItem
              icon={Target}
              label={`Valor ponderado (${t.moneda})`}
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

