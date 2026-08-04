/**
 * Tab Vs Real: comparativo presupuesto vs real del periodo seleccionado.
 * Periodo persistente en URL vía `?periodo_vs_real=YYYY-MM` (via `usePeriodoMesUrl`).
 * Fase J: sort por columna, filtro "solo excesos", barra + badge por fila.
 */
import { useMemo, useState } from "react";
import { FileText, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { VsRealFila } from "./VsRealFila";
import type { FilaVsReal } from "@/features/presupuesto/services";

type SortKey = "categoria" | "presupuesto" | "real" | "variacion" | "cumplimiento";
type SortDir = "asc" | "desc";


function ThSort({ label, active, dir, onClick, align = "left" }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void; align?: "left" | "right";
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function ordenarFilas(filas: FilaVsReal[], key: SortKey, dir: SortDir): FilaVsReal[] {
  const sign = dir === "asc" ? 1 : -1;
  const cmp: Record<SortKey, (a: FilaVsReal, b: FilaVsReal) => number> = {
    categoria: (a, b) => a.categoria_nombre.localeCompare(b.categoria_nombre, "es-MX"),
    presupuesto: (a, b) => a.presupuesto_mxn - b.presupuesto_mxn,
    real: (a, b) => a.real_mxn - b.real_mxn,
    variacion: (a, b) => a.variacion_mxn - b.variacion_mxn,
    cumplimiento: (a, b) => a.cumplimiento_pct - b.cumplimiento_pct,
  };
  return [...filas].sort((a, b) => cmp[key](a, b) * sign);
}

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
          <Label className="text-xs">Periodo</Label>
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
          <Label htmlFor="solo-excesos" className="text-xs">Solo excesos</Label>
        </div>
        <Button variant="outline" onClick={handlePdf} disabled={!data || generandoPdf}>
          {generandoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
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
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <ThSort label="Categoría" active={sortKey === "categoria"} dir={sortDir} onClick={() => toggleSort("categoria")} />
                    <ThSort label="Presupuesto" active={sortKey === "presupuesto"} dir={sortDir} onClick={() => toggleSort("presupuesto")} align="right" />
                    <ThSort label="Real" active={sortKey === "real"} dir={sortDir} onClick={() => toggleSort("real")} align="right" />
                    <ThSort label="Variación" active={sortKey === "variacion"} dir={sortDir} onClick={() => toggleSort("variacion")} align="right" />
                    <ThSort label="% cumplimiento" active={sortKey === "cumplimiento"} dir={sortDir} onClick={() => toggleSort("cumplimiento")} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        {soloExcesos
                          ? "Ninguna categoría excede el 110% este mes."
                          : "No hay categorías de presupuesto capturadas para este periodo."}
                      </p>
                      {soloExcesos && (
                        <Button variant="outline" size="sm" onClick={() => setSoloExcesos(false)}>
                          Quitar filtro "Solo excesos"
                        </Button>
                      )}
                    </td></tr>
                  ) : (
                    filasVisibles.map((f, i) => <VsRealFila key={f.categoria_id} fila={f} striped={i % 2 === 1} />)
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
