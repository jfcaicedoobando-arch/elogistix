import { Calendar, Download, FileText, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { useEstadoResultados } from "@/features/profit/hooks/useEstadoResultados";
import {
  EstadoResultadosTable,
} from "@/features/profit/components/EstadoResultadosTable";
import {
  ESTADO_RESULTADOS_CSV_HEADERS,
  buildEstadoResultadosCsvRows,
} from "@/features/profit/components/EstadoResultadosTable.helpers";
import { exportToCsv } from "@/generators/exportCsv";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReporteEERRDocument } from "@/pdf/documents/ReporteEERRDocument";
import { PageContainer } from "@/components/shared/PageContainer";
import { withOrgPrefix } from "@/lib/filenames";
import { FuenteEerrToggle } from "@/features/profit/components/FuenteEerrToggle";
import { ProfitSubNav } from "@/features/profit/components/ProfitSubNav";
import { PeriodoMensualToolbar } from "@/features/profit/components/PeriodoMensualToolbar";

export default function ProfitEstadoResultados() {
  const c = useEstadoResultados();
  const data = c.data;

  const handleExport = () => {
    if (!data) return;
    exportToCsv(
      `estado-resultados-${c.mesActual.key}.csv`,
      ESTADO_RESULTADOS_CSV_HEADERS,
      buildEstadoResultadosCsvRows(data),
    );
  };

  const handleExportPdf = async () => {
    if (!data) return;
    await descargarPdf(
      <ReporteEERRDocument periodo={c.mesActual.key} fuente={c.fuente} data={data} />,
      await withOrgPrefix(`Reporte_EERR_${c.mesActual.key}.pdf`),
    );
  };


  const sinDatos = !c.isLoading && data && data.ingresos.length === 0 && data.costos.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Estado de Resultados"
        description="P&G mensual por modo de transporte basado en ETA del embarque"
        tabs={<ProfitSubNav />}
      />


      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={c.irMesAnterior} disabled={!c.puedeIrAtras} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={c.mesActual.key} onValueChange={c.setMesKey}>
              <SelectTrigger className="w-[220px] font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                {c.mesesDisponibles.slice().reverse().map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={c.irMesSiguiente} disabled={!c.puedeIrAdelante} aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <FuenteEerrToggle />
          <div className="flex-1" />
          <Button variant="outline" onClick={handleExport} disabled={!data || sinDatos === true}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={!data || sinDatos === true}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
        <Info className="h-3 w-3" />
        {c.fuente === "facturas"
          ? "Fuente devengada: facturas emitidas (CxC) menos NC aplicadas, contra facturas de proveedor (CxP) del mismo mes."
          : "Fuente operativa: conceptos del embarque cuya ETA cae en el mes. Excluye Cancelados y Multimodal."}
        {" "}Montos en MXN.
      </p>

      <Card>
        <CardContent className="p-0">
          {c.isLoading ? (
            <div className="p-6"><ListSkeleton rows={4} /></div>
          ) : sinDatos || !data ? (
            <EmptyStateInline
              icon={Calendar}
              message={`Sin embarques con ETA en ${c.mesActual.label}`}
              hint="Selecciona otro mes."
            />
          ) : (
            <EstadoResultadosTable data={data} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
