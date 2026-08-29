/**
 * /compras/reportes — Ola F. Analítica de gasto: top proveedores, evolución
 * mensual y distribución por moneda. Reutiliza el listado de facturas de
 * proveedor filtrado por fechas de emisión.
 */
import { useMemo, useState } from "react";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
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
import { descargarBlob } from "@/lib/downloadBlob";
import { toCSV } from "@/lib/io/csv";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";
import { fetchFacturasReporte } from "@/features/compras/services/reportesFetch";
import { fetchExchangeRates } from "@/features/catalogos/services";
import { aMxn } from "@/lib/financial/convertir";
import { todayLocalISO } from "@/lib/date/today";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { TipoCambioFallbackBanner } from "@/features/dashboard/direccion/components/TipoCambioFallbackBanner";


function firstOfYear(): string { return `${new Date().getFullYear()}-01-01`; }
function today(): string { return todayLocalISO(); }

export default function ComprasReportes() {
  const [desde, setDesde] = useState<string>(firstOfYear());
  const [hasta, setHasta] = useState<string>(today());
  const { organizationId, orgListo } = useOrgFilter();

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: [...compras.reportes({ desde, hasta }), organizationId],
    queryFn: () => fetchFacturasReporte(desde, hasta, organizationId),
    // N-3: no consultar hasta que el contexto de organización resolvió.
    enabled: orgListo,
  });

  const { data: rates } = useQuery({
    queryKey: compras.exchangeRatesDofToday(),
    queryFn: () => fetchExchangeRates(todayLocalISO()),
    staleTime: 1000 * 60 * 60,
  });

  const totalMxn = rows.filter((r) => r.moneda === "MXN").reduce((a, r) => a + r.total, 0);
  const totalUsd = rows.filter((r) => r.moneda === "USD").reduce((a, r) => a + r.total, 0);
  const totalEur = rows.filter((r) => r.moneda === "EUR").reduce((a, r) => a + r.total, 0);
  const numFacturas = rows.length;

  const tcDof = rates?.usdMxn;
  const tcEurDof = rates?.eurMxn;

  // Top proveedores — agrupamos por proveedor y moneda.
  const topProveedores = useMemo(() => {
    const map = new Map<string, { nombre: string; mxn: number; usd: number; eur: number; count: number; mxnEquiv: number }>();
    for (const r of rows) {
      const key = r.proveedor_id ?? r.proveedor_nombre ?? "—";
      const cur = map.get(key) ?? { nombre: r.proveedor_nombre ?? "—", mxn: 0, usd: 0, eur: 0, count: 0, mxnEquiv: 0 };
      cur.count += 1;

      // M-3: la conversión pasa por el canon único (`aMxn`); EUR usa su
      // propio tipo de cambio en vez de compartir el del USD.
      const tcMoneda = r.moneda === "USD" ? (r.tipo_cambio_usd || tcDof) : tcEurDof;
      const equiv = r.moneda === "MXN" ? r.total : aMxn(r.total, r.moneda, tcMoneda).monto;

      if (r.moneda === "MXN") cur.mxn += r.total;
      else if (r.moneda === "USD") cur.usd += r.total;
      else cur.eur += r.total;

      // Sólo sumamos al equivalente si hubo un TC confiable (factura o DOF).
      cur.mxnEquiv += equiv;

      map.set(key, cur);
    }
    
    return Array.from(map.values())
      .sort((a, b) => {
        // Si no hay TC para alguno de los dos en sus facturas USD y no hay DOF,
        // la comparación puede ser imperfecta, pero seguimos la instrucción.
        return b.mxnEquiv - a.mxnEquiv;
      })
      .slice(0, 10);
  }, [rows, tcDof, tcEurDof]);

  // Evolución mensual (YYYY-MM) por moneda.
  const evolucion = useMemo(() => {
    const map = new Map<string, { mes: string; mxn: number; usd: number; eur: number }>();
    for (const r of rows) {
      if (!r.fecha_emision) continue;
      const mes = r.fecha_emision.slice(0, 7);
      const cur = map.get(mes) ?? { mes, mxn: 0, usd: 0, eur: 0 };
      if (r.moneda === "MXN") cur.mxn += r.total;
      else if (r.moneda === "USD") cur.usd += r.total;
      else cur.eur += r.total;
      map.set(mes, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [rows]);

  const handleExport = () => {
    try {
      const csv = toCSV(
        topProveedores.map((p) => ({
          proveedor: p.nombre,
          facturas: p.count,
          total_mxn: p.mxn,
          total_usd: p.usd,
          total_eur: p.eur,
          total_equivalente_mxn: p.mxnEquiv,
        })),
      );
      descargarBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `compras-top-proveedores-${desde}-${hasta}.csv`);
      notifySuccess(undefined, { title: "CSV descargado", description: `${topProveedores.length} proveedores exportados.` });
    } catch (e) {
      notifyError(undefined, { title: "No se pudo exportar el CSV", error: e, method: "EXPORT_REPORTES_CSV" });
    }
  };

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
