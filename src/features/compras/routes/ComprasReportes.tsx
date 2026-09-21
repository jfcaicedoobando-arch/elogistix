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
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { TipoCambioFallbackBanner } from "@/components/shared/TipoCambioFallbackBanner";
import { useComprasReportesController } from "../hooks/useComprasReportesController";

export default function ComprasReportes() {
  const {
    desde, setDesde, hasta, setHasta,
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={topProveedores.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="rep-desde">{RANGO_DESDE_LABEL}</Label>
            <DatePickerMx value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-hasta">{RANGO_HASTA_LABEL}</Label>
            <DatePickerMx value={hasta} onChange={setHasta} />
          </div>
        </CardContent>
      </Card>

      {isError && (
        <ErrorState className="mb-4" onRetry={() => void refetch()} />
      )}

      {/* EC-10: aviso cuando el T/C usado para los equivalentes es de respaldo. */}
      <TipoCambioFallbackBanner />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip
                    formatter={(v: number, name: string) =>
                      [formatCurrency(v, name === "usd" ? "USD" : name === "eur" ? "EUR" : "MXN"), name.toUpperCase()]
                    }
                  />
                  <Legend />
                  <Bar dataKey="mxn" name="MXN" fill="hsl(var(--primary))" />
                  <Bar dataKey="usd" name="USD" fill="hsl(var(--accent))" />
                  <Bar dataKey="eur" name="EUR" fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
