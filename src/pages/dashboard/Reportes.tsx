import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import ReportesFiltros from "@/components/reportes/ReportesFiltros";
import ReportesKpiCards from "@/components/reportes/ReportesKpiCards";
import ReportesTopChart from "@/components/reportes/ReportesTopChart";
import ReportesTablaClientes from "@/components/reportes/ReportesTablaClientes";
import { useReportesPageController } from "@/hooks/reportes/useReportesPageController";

export default function Reportes() {
  const {
    fechaDesde,
    fechaHasta,
    modo,
    setFechaDesde,
    setFechaHasta,
    setModo,
    kpis,
    isLoading,
    sorted,
    top10,
    sortField,
    sortDir,
    handleSort,
    handleExport,
    canExport,
  } = useReportesPageController();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rentabilidad por Cliente"
        description="P&L agrupado por cuenta con filtros de periodo y modo"
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!canExport}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        }
      />

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
        <ReportesTablaClientes
          data={sorted}
          isLoading={isLoading}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>
    </div>
  );
}
