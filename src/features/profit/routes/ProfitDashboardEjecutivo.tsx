/**
 * Dashboard Ejecutivo Financiero — vista consolidada.
 * Periodo persistente en URL via `?mes=YYYY-MM`.
 */
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { Download } from "lucide-react";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { useDashboardEjecutivo } from "@/features/dashboardEjecutivo/hooks/useDashboardEjecutivo";
import { BandaKPIs } from "@/features/dashboardEjecutivo/components/BandaKPIs";
import { BandaKPIsEficiencia } from "@/features/dashboardEjecutivo/components/BandaKPIsEficiencia";
import { GraficoEERR12m } from "@/features/dashboardEjecutivo/components/GraficoEERR12m";
import { ForecastMultiMesChart } from "@/features/dashboardEjecutivo/components/ForecastMultiMesChart";
import { SaldosBancosCard } from "@/features/dashboardEjecutivo/components/SaldosBancosCard";
import { TopListaCard } from "@/features/dashboardEjecutivo/components/TopListaCard";
import { MiniFlujoCard } from "@/features/dashboardEjecutivo/components/MiniFlujoCard";
import { AlertasPanel } from "@/features/dashboardEjecutivo/components/AlertasPanel";
import { toast } from "sonner";
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError } from "@/lib/ui/appFeedback";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { usePeriodoMesUrl } from "@/features/profit/hooks/usePeriodoMesUrl";
import { PeriodoMensualToolbar } from "@/features/profit/components/PeriodoMensualToolbar";
import { FuenteEerrToggle } from "@/features/profit/components/FuenteEerrToggle";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { ProfitSubNav } from "@/features/profit/components/ProfitSubNav";

const MES_MINIMO = "2026-04";

export default function ProfitDashboardEjecutivo() {
  const periodoCtl = usePeriodoMesUrl("mes", MES_MINIMO);
  const periodo = periodoCtl.mesActual.key;
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useDashboardEjecutivo(periodo);

  const exportar = useMemo(() => async () => {
    if (!data || generandoPdf) return;
    setGenerandoPdf(true);
    try {
      const blob = await pdf(<ReporteEjecutivoDocument snapshot={data} />).toBlob();
      descargarBlob(blob, `dashboard-ejecutivo-${data.periodo}.pdf`);
    } catch (e) {
      notifyError(toast, { title: "No se pudo generar el PDF", error: e, method: "PAGES_PROFIT_PROFITDASHBOARDEJECUTIVO_1" });
      reportCaughtError(e, { feature: "pnl", op: "generar_pdf_ejecutivo" }, { periodo: data?.periodo });
    } finally {
      setGenerandoPdf(false);
    }
  }, [data, generandoPdf]);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard Ejecutivo"
        description="Vista consolidada de la situación financiera."
        tabs={<ProfitSubNav />}
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <PeriodoMensualToolbar
            mesActual={periodoCtl.mesActual}
            mesesDisponibles={periodoCtl.mesesDisponibles}
            onChange={periodoCtl.setMesKey}
            onPrev={periodoCtl.irMesAnterior}
            onNext={periodoCtl.irMesSiguiente}
            puedeIrAtras={periodoCtl.puedeIrAtras}
            puedeIrAdelante={periodoCtl.puedeIrAdelante}
          />
          <div className="flex-1" />
          <FuenteEerrToggle />
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data || generandoPdf}>
            <Download className="h-4 w-4 mr-1" /> {generandoPdf ? "Generando…" : "PDF"}
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          <KpiGridSkeleton count={6} heightClass="h-24" desktopCols={6} />
          <ChartSkeleton height={256} />
        </div>
      )}

      {error && (
        <ErrorStateInline
          message={(error as Error).message}
          onRetry={() => { void refetch(); }}
          retrying={isFetching}
        />
      )}

      {data && (
        <>
          <BandaKPIs
            kpis={data.kpis}
            topDeudores={data.topDeudores}
            topAcreedores={data.topAcreedores}
            presupuesto={data.presupuesto}
          />
          <BandaKPIsEficiencia kpis={data.kpis} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2"><GraficoEERR12m data={data.eerr12m} /></div>
            <SaldosBancosCard cuentas={data.tesoreria.cuentas} />
          </div>
          <ForecastMultiMesChart historico={data.eerr12m} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <TopListaCard title="Top 5 deudores" items={data.topDeudores} emptyText="Sin cartera vencida." />
            <TopListaCard title="Top 5 acreedores" items={data.topAcreedores} emptyText="Sin CxP pendiente." />
            <AlertasPanel alertas={data.alertas} />
          </div>
          <MiniFlujoCard flujo={data.flujo} />
        </>
      )}
    </PageContainer>
  );
}
