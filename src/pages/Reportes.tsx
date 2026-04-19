import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/generators/exportCsv";
import { useRentabilidadClientes } from "@/hooks/useRentabilidadClientes";
import ReportesFiltros from "@/components/reportes/ReportesFiltros";
import ReportesKpiCards from "@/components/reportes/ReportesKpiCards";
import ReportesTopChart from "@/components/reportes/ReportesTopChart";
import ReportesTablaClientes, { type SortField } from "@/components/reportes/ReportesTablaClientes";

export default function Reportes() {
  const now = new Date();
  const [fechaDesde, setFechaDesde] = useState<Date>(startOfMonth(now));
  const [fechaHasta, setFechaHasta] = useState<Date>(endOfMonth(now));
  const [modo, setModo] = useState("all");
  const [sortField, setSortField] = useState<SortField>("profit_usd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtros = useMemo(
    () => ({
      fechaDesde: format(fechaDesde, "yyyy-MM-dd"),
      fechaHasta: format(fechaHasta, "yyyy-MM-dd"),
      modo: modo === "all" ? undefined : modo,
    }),
    [fechaDesde, fechaHasta, modo],
  );

  const { clientes, kpis, isLoading } = useRentabilidadClientes(filtros);

  const sorted = useMemo(() => {
    const copy = [...clientes];
    copy.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return copy;
  }, [clientes, sortField, sortDir]);

  const top10 = useMemo(
    () =>
      [...clientes]
        .sort((a, b) => b.profit_usd - a.profit_usd)
        .slice(0, 10)
        .map((c) => ({
          name: c.cliente_nombre.length > 18 ? c.cliente_nombre.slice(0, 18) + "…" : c.cliente_nombre,
          profit: Math.round(c.profit_usd * 100) / 100,
        })),
    [clientes],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleExport = () => {
    exportToCsv(
      "rentabilidad_clientes.csv",
      [
        { key: "cliente_nombre", label: "Cliente" },
        { key: "total_embarques", label: "Embarques" },
        { key: "venta_usd", label: "Venta USD" },
        { key: "costo_usd", label: "Costo USD" },
        { key: "profit_usd", label: "Profit USD" },
        { key: "margen", label: "Margen %" },
      ],
      sorted.map((c) => ({ ...c, margen: c.margen.toFixed(1) })),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rentabilidad por Cliente</h1>
          <p className="text-sm text-muted-foreground">P&amp;L agrupado por cuenta con filtros de periodo y modo</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={sorted.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <ReportesFiltros
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
        modo={modo}
        onFechaDesdeChange={setFechaDesde}
        onFechaHastaChange={setFechaHasta}
        onModoChange={setModo}
      />

      <ReportesKpiCards kpis={kpis} isLoading={isLoading} />

      <div className="grid lg:grid-cols-5 gap-6">
        <ReportesTopChart data={top10} isLoading={isLoading} />
        <ReportesTablaClientes data={sorted} isLoading={isLoading} sortField={sortField} sortDir={sortDir} onSort={handleSort} />
      </div>
    </div>
  );
}
