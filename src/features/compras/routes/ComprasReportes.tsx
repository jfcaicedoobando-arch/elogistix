/**
 * /compras/reportes — Ola F. Analítica de gasto: top proveedores, evolución
 * mensual y distribución por moneda. Reutiliza el listado de facturas de
 * proveedor filtrado por fechas de emisión.
 *
 * P1-B: datos/estado/exportación viven en `useComprasReportesController`.
 */
import {
  BarChart3, Download, TrendingUp, Banknote, Coins,
} from "lucide-react";
import { TopProveedoresCard } from "./_sections/TopProveedoresCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { CHART, CHART_TICK, CHART_AXIS_STROKE, CHART_LEGEND_STYLE, CHART_BAR_RADIUS } from "@/lib/chartTokens";
import { formatCurrency } from "@/lib/formatters";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { TipoCambioFallbackBanner } from "@/components/shared/TipoCambioFallbackBanner";
import { useComprasReportesController } from "../hooks/useComprasReportesController";

export default function ComprasReportes() {
  const {
    desde, setDesde, hasta, setHasta, errorRango,
    isLoading, isError, refetch,
    numFacturas, totalMxn, totalUsd, totalEur,
    topProveedores, evolucion, handleExport,
  } = useComprasReportesController();

  return (
    <PageContainer>
      <PageHeader
        icon={<BarChart3 className="h-6 w-6 text-accent" />}
        title="Reportes de compras"
        description="Analítica de gasto por proveedor y período. Basado en fecha de emisión de la factura."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!!errorRango || isLoading || isError || topProveedores.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="rep-desde">{RANGO_DESDE_LABEL}</Label>
            <DatePickerMx id="rep-desde" value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-hasta">{RANGO_HASTA_LABEL}</Label>
            <DatePickerMx id="rep-hasta" value={hasta} onChange={setHasta} errorText={errorRango} />
          </div>
        </CardContent>
      </Card>

      {!errorRango && isError && (
        <ErrorState className="mb-4" onRetry={() => void refetch()} />
      )}

      {!errorRango && !isError && <>
      {/* EC-10: aviso cuando el T/C usado para los equivalentes es de respaldo. */}
      <TipoCambioFallbackBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Facturas en el período" value={String(numFacturas)} icon={TrendingUp} />
        <KpiCard label="Subtotal MXN (sin IVA)" value={formatCurrency(totalMxn, "MXN")} icon={Banknote} />
        <KpiCard label="Subtotal USD (sin IVA)" value={formatCurrency(totalUsd, "USD")} icon={Coins} />
        <KpiCard label="Subtotal EUR (sin IVA)" value={formatCurrency(totalEur, "EUR")} icon={Coins} />
      </div>

      <TopProveedoresCard isLoading={isLoading} rows={topProveedores} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" /> Evolución mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evolucion.length === 0 ? (
            <EmptyStateInline icon={TrendingUp} message="Sin datos para graficar." className="py-4" />
          ) : (
            <div className="w-full h-[280px]">
              <ResponsiveContainer>
                <BarChart data={evolucion}>
                  <CartesianGrid stroke={CHART.border} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tick={CHART_TICK} stroke={CHART_AXIS_STROKE} />
                  <YAxis tick={CHART_TICK} stroke={CHART_AXIS_STROKE} />
                  <Tooltip
                    cursor={{ fill: CHART.border, fillOpacity: 0.15 }}
                    content={<ChartTooltip formatValue={(valor, serie) => formatCurrency(valor, serie.toUpperCase())} />}
                  />
                  <Legend itemSorter={(item) => ["mxn", "usd", "eur"].findIndex((key) => key === item.dataKey)} wrapperStyle={CHART_LEGEND_STYLE} formatter={(label) => <span className="text-foreground">{label}</span>} />
                  <Bar dataKey="mxn" name="MXN" fill={CHART.primary} radius={CHART_BAR_RADIUS} />
                  <Bar dataKey="usd" name="USD" fill={CHART.success} radius={CHART_BAR_RADIUS} />
                  <Bar dataKey="eur" name="EUR" fill={CHART.warning} radius={CHART_BAR_RADIUS} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      </>}
    </PageContainer>
  );
}
