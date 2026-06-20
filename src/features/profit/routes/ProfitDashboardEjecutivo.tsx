/**
 * Dashboard Ejecutivo Financiero — vista consolidada (Sprint 6 / v12.49.0).
 */
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { useDashboardEjecutivo } from "@/features/dashboardEjecutivo/hooks/useDashboardEjecutivo";
import { SelectorPeriodo, type PresetPeriodo } from "@/features/dashboardEjecutivo/components/SelectorPeriodo";
import { BandaKPIs } from "@/features/dashboardEjecutivo/components/BandaKPIs";
import { GraficoEERR12m } from "@/features/dashboardEjecutivo/components/GraficoEERR12m";
import { SaldosBancosCard } from "@/features/dashboardEjecutivo/components/SaldosBancosCard";
import { TopListaCard } from "@/features/dashboardEjecutivo/components/TopListaCard";
import { MiniFlujoCard } from "@/features/dashboardEjecutivo/components/MiniFlujoCard";
import { AlertasPanel } from "@/features/dashboardEjecutivo/components/AlertasPanel";
import { ReporteEjecutivoDocument } from "@/pdf/documents/ReporteEjecutivoDocument";
import { safeSessionStorage, STORAGE_KEYS } from "@/lib/browserStorage";
import { toast } from "sonner";
import { descargarBlob } from "@/lib/downloadBlob";

import { notifyError } from "@/components/shared/utils/appFeedback";
function periodoInicial(): string {
  const guardado = safeSessionStorage.getItem(STORAGE_KEYS.dashboardEjecutivoPeriodo);
  if (guardado && /^\d{4}-\d{2}$/.test(guardado)) return guardado;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ProfitDashboardEjecutivo() {
  const [periodo, setPeriodo] = useState<string>(periodoInicial);
  const [preset, setPreset] = useState<PresetPeriodo>("actual");
  const { data, isLoading, error } = useDashboardEjecutivo(periodo);

  const handlePeriodo = (p: string, pr: PresetPeriodo) => {
    setPeriodo(p);
    setPreset(pr);
    safeSessionStorage.setItem(STORAGE_KEYS.dashboardEjecutivoPeriodo, p);
  };

  const exportar = useMemo(() => async () => {
    if (!data) return;
    try {
      const blob = await pdf(<ReporteEjecutivoDocument snapshot={data} />).toBlob();
      descargarBlob(blob, `dashboard-ejecutivo-${data.periodo}.pdf`);
    } catch (e) {
      notifyError(toast, { title: "No se pudo generar el PDF", error: e, method: "PAGES_PROFIT_PROFITDASHBOARDEJECUTIVO_1" });
      reportCaughtError(e, { feature: "pnl", op: "generar_pdf_ejecutivo" }, { periodo: data?.periodo });
    }
  }, [data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard Ejecutivo"
        description="Vista consolidada de la situación financiera."
        actions={
          <div className="flex items-center gap-2">
            <SelectorPeriodo value={periodo} preset={preset} onChange={handlePeriodo} />
            <Button variant="outline" size="sm" onClick={exportar} disabled={!data}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        }
      />

      {isLoading && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}

      {error && (
        <div className="p-4 border rounded text-sm text-destructive">
          Error al cargar el snapshot: {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <BandaKPIs kpis={data.kpis} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2"><GraficoEERR12m data={data.eerr12m} /></div>
            <SaldosBancosCard cuentas={data.tesoreria.cuentas} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <TopListaCard title="Top 5 deudores" items={data.topDeudores} emptyText="Sin cartera vencida." />
            <TopListaCard title="Top 5 acreedores" items={data.topAcreedores} emptyText="Sin CxP pendiente." />
            <AlertasPanel alertas={data.alertas} />
          </div>
          <MiniFlujoCard flujo={data.flujo} />
        </>
      )}
    </div>
  );
}
