/**
 * Tab Vs Real: comparativo presupuesto vs real del periodo seleccionado.
 * Periodo persistente en URL vía `?periodo_vs_real=YYYY-MM` (via `usePeriodoMesUrl`).
 * Fase J: sort por columna, filtro "solo excesos", barra + badge por fila.
 *
 * Excepción documentada al guardrail `no-raw-table` (Ola F, punto 8): el
 * encabezado ordenable (`ThSort`) y las filas con barra de cumplimiento
 * (`VsRealFila`) no encajan en el contrato de columnas de `<DataTable />`.
 * Se homologa usando `Table`/`TableHeader`/`TableBody` (de `ui/table`) en
 * vez de un `<table>` crudo, para compartir estilos base con el resto del ERP.
 */
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/skeletons";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PeriodoMensualToolbar } from "@/features/profit/components/PeriodoMensualToolbar";
import { usePresupuestoVsReal } from "@/features/presupuesto/hooks";
import { formatCurrency } from "@/lib/formatters/numbers";
import { descargarPdf } from "@/pdf/render/descargarPdf";
// P12: ReportePresupuestoDocument se carga dinámicamente en el handler.
import { withOrgPrefix } from "@/lib/filenames";
import { usePeriodoMesUrl } from "@/features/profit/hooks/usePeriodoMesUrl";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { usePdfExport } from "@/hooks/shared";
import { Table, TableHeader, TableBody } from "@/components/ui/table";
import { DetailTableRow } from "@/components/shared/DetailTable";
import { ThSort } from "./VsRealSortableHeader";
import { ordenarFilas, type SortKey, type SortDir } from "./vsRealSort";
import { AvisoGastosSinTc, VsRealCuerpo } from "./VsRealCuerpo";

export function TabVsReal() {
  const periodoCtl = usePeriodoMesUrl("periodo_vs_real");
  const { mesActual, setMesKey } = periodoCtl;
  const periodo = mesActual.key;
  const { isExporting: generandoPdf, run: runPdfExport } = usePdfExport({
    successTitle: "Reporte PDF descargado",
    method: "PRESUPUESTO_VS_REAL_EXPORT_PDF",
  });
  const [sortKey, setSortKey] = useState<SortKey>("variacion");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [soloExcesos, setSoloExcesos] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = usePresupuestoVsReal(periodo);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "categoria" ? "asc" : "desc"); }
  };

  const filasVisibles = useMemo(() => {
    if (!data) return [];
    const base = soloExcesos
      ? data.filas.filter((f) => f.presupuesto_mxn > 0 && f.cumplimiento_pct > 110)
      : data.filas;
    return ordenarFilas(base, sortKey, sortDir);
  }, [data, sortKey, sortDir, soloExcesos]);

  const handlePdf = () => {
    if (!data) return;
    void runPdfExport(async () => {
      const { ReportePresupuestoDocument } = await import("@/pdf/documents/ReportePresupuestoDocument");
      await descargarPdf(
        <ReportePresupuestoDocument resumen={data} />,
        await withOrgPrefix(`Reporte_Presupuesto_${periodo}.pdf`),
      );
    });
  };

  const sinPresupuestoGlobal = !!data && data.total_presupuesto_mxn === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Periodo</Label>
          <PeriodoMensualToolbar
            mesActual={mesActual}
            mesesDisponibles={periodoCtl.mesesDisponibles}
            onChange={setMesKey}
            onPrev={periodoCtl.irMesAnterior}
            onNext={periodoCtl.irMesSiguiente}
            puedeIrAtras={periodoCtl.puedeIrAtras}
            puedeIrAdelante={periodoCtl.puedeIrAdelante}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="solo-excesos" checked={soloExcesos} onCheckedChange={setSoloExcesos} />
          <Label htmlFor="solo-excesos">Solo excesos</Label>
        </div>
        <Button loading={generandoPdf} variant="outline" onClick={handlePdf} disabled={!data || generandoPdf}>
          <FileText className="h-4 w-4 mr-2" />
          {generandoPdf ? "Generando…" : "PDF"}
        </Button>
      </div>

      {error ? (
        <ErrorStateInline
          message={(error as Error).message}
          onRetry={() => { void refetch(); }}
          retrying={isFetching}
        />
      ) : isLoading || !data ? (
        <CardSkeleton lines={8} />
      ) : (
        <>
          {data.real_truncado && (
            <Card className="border-warning/50">
              <CardContent className="p-3 text-sm text-warning">
                El real de este periodo alcanzó el límite de filas consultadas y puede estar
                incompleto. Refina el periodo o contacta a soporte para un corte exacto.
              </CardContent>
            </Card>
          )}
          {data.gastos_sin_tc_count > 0 && <AvisoGastosSinTc count={data.gastos_sin_tc_count} />}

          {sinPresupuestoGlobal && (
            <Card className="border-dashed">
              <CardContent className="p-3 text-sm text-muted-foreground">
                No hay presupuesto capturado para {periodo}. Captúralo en la pestaña "Captura" para ver el comparativo.
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard label="Total presupuesto" value={formatCurrency(data.total_presupuesto_mxn, "MXN")} />
            <KpiCard label="Total real" value={formatCurrency(data.total_real_mxn, "MXN")} />
            <KpiCard
              label="Variación neta"
              value={formatCurrency(data.variacion_neta_mxn, "MXN")}
              variant={sinPresupuestoGlobal ? "default" : data.variacion_neta_mxn <= 0 ? "success" : "destructive"}
            />
            <KpiCard
              label="Categorías en exceso"
              value={data.categorias_en_exceso.toString()}
              variant={data.categorias_en_exceso > 0 ? "destructive" : "success"}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <DetailTableRow hoverable={false}>
                    <ThSort label="Categoría" active={sortKey === "categoria"} dir={sortDir} onClick={() => toggleSort("categoria")} />
                    <ThSort label="Presupuesto" active={sortKey === "presupuesto"} dir={sortDir} onClick={() => toggleSort("presupuesto")} align="right" />
                    <ThSort label="Real" active={sortKey === "real"} dir={sortDir} onClick={() => toggleSort("real")} align="right" />
                    <ThSort label="Variación" active={sortKey === "variacion"} dir={sortDir} onClick={() => toggleSort("variacion")} align="right" />
                    <ThSort label="% cumplimiento" active={sortKey === "cumplimiento"} dir={sortDir} onClick={() => toggleSort("cumplimiento")} align="right" />
                  </DetailTableRow>
                </TableHeader>
                <TableBody>
                  <VsRealCuerpo
                    filas={filasVisibles}
                    soloExcesos={soloExcesos}
                    onQuitarFiltro={() => setSoloExcesos(false)}
                  />
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
