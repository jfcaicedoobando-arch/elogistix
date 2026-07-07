/**
 * Tab Vs Real: comparativo presupuesto vs real del periodo seleccionado.
 */
import { useState } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MonthPickerMx } from "@/components/ui/month-picker-mx";
import { usePresupuestoVsReal } from "@/features/presupuesto/hooks";
import { formatCurrency } from "@/lib/formatters/numbers";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { ReportePresupuestoDocument } from "@/pdf/documents/ReportePresupuestoDocument";

function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" | "success" }) {
  const t = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold tabular-nums ${t}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function TabVsReal() {
  const [periodo, setPeriodo] = useState(mesActual());
  const { data, isLoading } = usePresupuestoVsReal(periodo);

  const handlePdf = async () => {
    if (!data) return;
    await descargarPdf(
      <ReportePresupuestoDocument resumen={data} />,
      `Reporte_Presupuesto_${periodo}.pdf`,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Periodo</Label>
          <MonthPickerMx value={periodo} onChange={setPeriodo} className="h-9" />
        </div>
        <Button variant="outline" onClick={handlePdf} disabled={!data}>
          <FileText className="h-4 w-4 mr-2" /> PDF
        </Button>
      </div>

      {isLoading || !data ? (
        <CardSkeleton lines={8} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Kpi label="Total presupuesto" value={formatCurrency(data.total_presupuesto_mxn, "MXN")} />
            <Kpi label="Total real" value={formatCurrency(data.total_real_mxn, "MXN")} />
            <Kpi
              label="Variación neta"
              value={formatCurrency(data.variacion_neta_mxn, "MXN")}
              tone={data.variacion_neta_mxn <= 0 ? "success" : "danger"}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Categoría</th>
                    <th className="px-3 py-2 text-right">Presupuesto</th>
                    <th className="px-3 py-2 text-right">Real</th>
                    <th className="px-3 py-2 text-right">Variación</th>
                    <th className="px-3 py-2 text-right">% cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((f, i) => {
                    const exceso = f.variacion_mxn > 0;
                    return (
                      <tr key={f.categoria_id} className={`border-t ${i % 2 === 1 ? "bg-muted/20" : ""}`}>
                        <td className="px-3 py-2 font-medium">{f.categoria_nombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(f.presupuesto_mxn, "MXN")}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(f.real_mxn, "MXN")}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-medium ${exceso ? "text-destructive" : "text-success"}`}>
                          {formatCurrency(f.variacion_mxn, "MXN")}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {f.presupuesto_mxn > 0 ? `${f.cumplimiento_pct.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
