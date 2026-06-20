import { lazy, Suspense } from "react";
import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import ReportesFiltros from "@/features/reportes/components/ReportesFiltros";
import ReportesKpiCards from "@/features/reportes/components/ReportesKpiCards";
import ReportesTablaClientes from "@/features/reportes/components/ReportesTablaClientes";
import { useReportesPageController } from "@/features/reportes/hooks";

// Lazy: difiere recharts (~95 KB gzip) fuera del TTI de la página.
const ReportesTopChart = lazy(() => import("@/features/reportes/components/ReportesTopChart"));

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
    handleExportPdf,
    canExport,
  } = useReportesPageController();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Rentabilidad por Cliente"
        description="P&L agrupado por cuenta con filtros de periodo y modo"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!canExport}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!canExport}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
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

      <Suspense fallback={<ChartSkeleton height={300} />}>
        <ReportesTopChart data={top10} isLoading={isLoading} />
      </Suspense>
      <ReportesTablaClientes
        data={sorted}
        isLoading={isLoading}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
