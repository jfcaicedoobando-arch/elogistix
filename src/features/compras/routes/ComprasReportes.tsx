/**
 * /compras/reportes — Ola F. Analítica de gasto: top proveedores, evolución
 * mensual y distribución por moneda. Reutiliza el listado de facturas de
 * proveedor filtrado por fechas de emisión.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { compras } from "../queryKeys";
import {
  BarChart3, Download, TrendingUp, Banknote, Coins, Building2,
} from "lucide-react";
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
import { todayLocalISO } from "@/lib/date/today";
import { DatePickerMx } from "@/components/ui/date-picker-mx";


function firstOfYear(): string { return `${new Date().getFullYear()}-01-01`; }
function today(): string { return todayLocalISO(); }

export default function ComprasReportes() {
  const [desde, setDesde] = useState<string>(firstOfYear());
  const [hasta, setHasta] = useState<string>(today());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: compras.reportes({ desde, hasta }),
    queryFn: () => fetchFacturasReporte(desde, hasta),
  });

  const { data: rates } = useQuery({
    queryKey: ["exchange-rates-dof-today"],
    queryFn: () => fetchExchangeRates(todayLocalISO()),
    staleTime: 1000 * 60 * 60,
  });

  const totalMxn = rows.filter((r) => r.moneda === "MXN").reduce((a, r) => a + r.total, 0);
  const totalUsd = rows.filter((r) => r.moneda === "USD").reduce((a, r) => a + r.total, 0);
  const numFacturas = rows.length;

  const tcDof = rates?.usdMxn;

  // Top proveedores — agrupamos por proveedor y moneda.
  const topProveedores = useMemo(() => {
    const map = new Map<string, { nombre: string; mxn: number; usd: number; count: number; mxnEquiv: number }>();
    for (const r of rows) {
      const key = r.proveedor_id ?? r.proveedor_nombre ?? "—";
      const cur = map.get(key) ?? { nombre: r.proveedor_nombre ?? "—", mxn: 0, usd: 0, count: 0, mxnEquiv: 0 };
      cur.count += 1;
      
      const tc = r.tipo_cambio_usd || tcDof || 0;
      const equiv = r.moneda === "MXN" ? r.total : (tc > 0 ? r.total * tc : 0);
      
      if (r.moneda === "MXN") cur.mxn += r.total; else cur.usd += r.total;
      
      // Solo sumamos al equivalente si tenemos un TC confiable (factura o DOF).
      // Si tc es 0, no sumamos al equivalente para evitar distorsiones.
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
  }, [rows, tcDof]);

  // Evolución mensual (YYYY-MM) por moneda.
  const evolucion = useMemo(() => {
    const map = new Map<string, { mes: string; mxn: number; usd: number }>();
    for (const r of rows) {
      if (!r.fecha_emision) continue;
      const mes = r.fecha_emision.slice(0, 7);
      const cur = map.get(mes) ?? { mes, mxn: 0, usd: 0 };
      if (r.moneda === "MXN") cur.mxn += r.total; else cur.usd += r.total;
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
        title="Reportes de Compras"
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
            <Label htmlFor="rep-desde" className="text-xs">Desde</Label>
            <DatePickerMx value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rep-hasta" className="text-xs">Hasta</Label>
            <DatePickerMx value={hasta} onChange={setHasta} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Facturas en el período" value={String(numFacturas)} icon={TrendingUp} />
        <KpiCard label="Total MXN" value={formatCurrency(totalMxn, "MXN")} icon={Banknote} />
        <KpiCard label="Total USD" value={formatCurrency(totalUsd, "USD")} icon={Coins} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" /> Top 10 proveedores por gasto
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
          ) : topProveedores.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sin facturas en el período seleccionado.
            </div>
          ) : (
            <div className="divide-y">
              {topProveedores.map((p, i) => (
                <div key={p.nombre + i} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                    <span className="truncate font-medium">{p.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      ({p.count} {p.count === 1 ? "factura" : "facturas"})
                    </span>
                  </div>
                  <div className="flex gap-4 tabular-nums text-xs">
                    {p.mxn > 0 && <span>{formatCurrency(p.mxn, "MXN")}</span>}
                    {p.usd > 0 && <span>{formatCurrency(p.usd, "USD")}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" /> Evolución mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evolucion.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Sin datos para graficar.
            </div>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={evolucion}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip
                    formatter={(v: number, name: string) =>
                      [formatCurrency(v, name === "usd" ? "USD" : "MXN"), name.toUpperCase()]
                    }
                  />
                  <Legend />
                  <Bar dataKey="mxn" name="MXN" fill="hsl(var(--primary))" />
                  <Bar dataKey="usd" name="USD" fill="hsl(var(--accent))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
