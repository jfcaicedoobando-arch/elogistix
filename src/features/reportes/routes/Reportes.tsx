import { lazy, Suspense } from "react";
import { Download, FileText, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import ReportesFiltros from "@/features/reportes/components/ReportesFiltros";
import ReportesKpiCards from "@/features/reportes/components/ReportesKpiCards";
import ReportesTablaClientes from "@/features/reportes/components/ReportesTablaClientes";
import { useReportesPageController } from "@/features/reportes/hooks/useReportesPageController";
import { PageContainer } from "@/components/shared/PageContainer";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { useDocumentTitle } from "@/hooks/shared";

// Lazy: difiere recharts (~95 KB gzip) fuera del TTI de la página.
const ReportesTopChart = lazy(() => import("@/features/reportes/components/ReportesTopChart"));

export default function Reportes() {
  useDocumentTitle("Reportes");
  const {
    fechaDesde,
    fechaHasta,
    modo,
    setFechaDesde,
    setFechaHasta,
    setModo,
    kpis,
    isLoading,
    isError,
    refetch,
    sorted,
    top10,
    sortField,
    sortDir,
    handleSort,
    handleExport,
    handleExportPdf,
    isExportingPdf,
    canExport,
  } = useReportesPageController();

  return (
    <PageContainer>
      <PageHeader
        title="Rentabilidad por cliente"
        description="P&L agrupado por cuenta con filtros de periodo y modo"
        actions={
          <>
            {/* Mobile: un solo dropdown "Exportar ▾" */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button loading={isExportingPdf} variant="outline" size="sm" disabled={!canExport}>
                    <Download className="h-4 w-4 mr-1" /> Exportar
                    <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleExportPdf} disabled={isExportingPdf}>
                    <FileText className="h-4 w-4 mr-2" /> PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" /> CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Desktop */}
            <div className="hidden sm:flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!canExport || isExportingPdf}>
                <FileText className="h-4 w-4 mr-2" />
                {isExportingPdf ? "Generando…" : "PDF"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={!canExport}>
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          </>
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

      {/* Ramas mutuamente excluyentes: error → contenido. En error no se
          muestran skeletons ni tarjetas con cifras en cero. */}
      {isError ? (
        <ErrorState
          className="mb-4"
          title="No se pudo cargar la rentabilidad"
          description="Revisa tu conexión y vuelve a intentar; los filtros se conservan."
          onRetry={() => void refetch()}
        />
      ) : (
        <>
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
        </>
      )}
    </PageContainer>
  );
}
