/**
 * Dashboard Ejecutivo Financiero — vista consolidada.
 * Periodo persistente en URL via `?mes=YYYY-MM`.
 *
 * Ola 19 · paso 2: vive en `dashboardEjecutivo` (antes en `profit/routes`),
 * para romper el ciclo de dependencias entre ambos features. Ahora la
 * dirección es única: dashboardEjecutivo → profit.
 */
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { Download, AlertTriangle } from "lucide-react";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { useDashboardEjecutivo } from "../hooks/useDashboardEjecutivo";
import { BandaKPIs } from "../components/BandaKPIs";
import { BandaKPIsEficiencia } from "../components/BandaKPIsEficiencia";
import { GraficoEERR12m } from "../components/GraficoEERR12m";
import { ForecastMultiMesChart } from "../components/ForecastMultiMesChart";
import { SaldosBancosCard } from "../components/SaldosBancosCard";
import { TopListaCard } from "../components/TopListaCard";
import { MiniFlujoCard } from "../components/MiniFlujoCard";
import { AlertasPanel } from "../components/AlertasPanel";
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError } from "@/lib/ui/appFeedback";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePeriodoMesUrl } from "@/features/profit/hooks/usePeriodoMesUrl";
import { PeriodoMensualToolbar } from "@/features/profit/components/PeriodoMensualToolbar";
import { FuenteEerrToggle } from "@/features/profit/components/FuenteEerrToggle";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { ProfitSubNav } from "@/features/profit/components/ProfitSubNav";
import { useDocumentTitle } from "@/hooks/shared";

const MES_MINIMO = "2026-04";

export default function DashboardEjecutivoPage() {
  useDocumentTitle("Dashboard ejecutivo");
  const periodoCtl = usePeriodoMesUrl("mes", MES_MINIMO);
  const periodo = periodoCtl.mesActual.key;
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useDashboardEjecutivo(periodo);

  const exportar = useMemo(() => async () => {
    if (!data || generandoPdf) return;
    setGenerandoPdf(true);
    try {
      // P12: dynamic import — @react-pdf/renderer + Document sólo entran al bundle al presionar Descargar.
      const [{ pdf }, { ReporteEjecutivoDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/pdf/documents/ReporteEjecutivoDocument"),
      ]);
      const blob = await pdf(<ReporteEjecutivoDocument snapshot={data} />).toBlob();
      descargarBlob(blob, `dashboard-ejecutivo-${data.periodo}.pdf`);
    } catch (e) {
      notifyError(undefined, { title: "No se pudo generar el PDF", error: e, method: "PAGES_PROFIT_PROFITDASHBOARDEJECUTIVO_1" });
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

      {/* Máquina de estados: loading → error → empty → data. Exactamente una
          rama se renderiza; nunca pantalla en blanco. */}
      {isLoading ? (
        <div className="space-y-3">
          <KpiGridSkeleton count={6} heightClass="h-24" desktopCols={6} />
          <ChartSkeleton height={256} />
        </div>
      ) : error ? (
        <ErrorStateInline
          message={(error as Error).message}
          onRetry={() => { void refetch(); }}
          retrying={isFetching}
        />
      ) : !data ? (
        <ErrorStateInline
          title="Sin información para el periodo"
          message="No hay datos consolidados para el periodo seleccionado."
          onRetry={() => { void refetch(); }}
          retrying={isFetching}
        />
      ) : (
        <>
      {data.tcEsFallback && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tipo de cambio no disponible</AlertTitle>
          <AlertDescription>
            No se pudo consultar el TC del DOF; los saldos en dólares se valuaron con el tipo de
            cambio de respaldo ({data.tipoCambioUsd.toFixed(4)} MXN/USD). Úsalo sólo como referencia.
          </AlertDescription>
        </Alert>
      )}

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
