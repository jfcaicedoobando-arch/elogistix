/**
 * Dashboard de Tesorería: saldo consolidado, cartera 30 días, curva de flujo
 * proyectado y top de cartera vencida (CxC/CxP).
 */
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
import { Link } from "react-router-dom";
import { Wallet, ArrowRight, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useMovimientosPendientes, useResumenTesoreria } from "@/features/tesoreria/hooks";
import { formatCurrency } from "@/lib/formatters";
import { descargarPdf } from "@/pdf/render/descargarPdf";
// P12: ReporteTesoreriaDocument se carga dinámicamente en el handler.
import { PageContainer } from "@/components/shared/PageContainer";
import { withOrgPrefix } from "@/lib/filenames";
import { ROUTES } from "@/constants/routes";
import { todayLocalISO } from "@/lib/date/today";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatFechaEs } from "@/lib/formatters/dates";
import { TesoreriaKpis } from "./_sections/TesoreriaKpis";
import { TesoreriaFlujoMonedas } from "./_sections/TesoreriaFlujoMonedas";
import { TesoreriaFlujoChart } from "./_sections/TesoreriaFlujoChart";
import { TesoreriaTopCartera } from "./_sections/TesoreriaTopCartera";

export default function Tesoreria() {
  const { data, isLoading, isError, refetch } = useResumenTesoreria();
  const pendientesQ = useMovimientosPendientes();
  const pendientes = pendientesQ.data ?? 0;
  const hoy = todayLocalISO();

  const handlePdf = async () => {
    if (!data) return;
    const { ReporteTesoreriaDocument } = await import("@/pdf/documents/ReporteTesoreriaDocument");
    await descargarPdf(
      <ReporteTesoreriaDocument fechaCorte={hoy} resumen={data} />,
      await withOrgPrefix(`Reporte_Tesoreria_${hoy}.pdf`),
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Tesorería"
        description={`Saldo bancario, cartera y flujo esperado · saldos al ${formatFechaEs(hoy)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handlePdf} disabled={!data}>
              <FileText className="mr-2 h-4 w-4" /> Reporte PDF
            </Button>
            <Button variant="outline" asChild>
              <Link to={ROUTES.TESORERIA_CUENTAS}><Wallet className="mr-2 h-4 w-4" /> Cuentas</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={ROUTES.TESORERIA_FLUJO}><TrendingUp className="mr-2 h-4 w-4" /> Flujo 90 días</Link>
            </Button>
            <Button asChild>
              <Link to={ROUTES.TESORERIA_CONCILIACION}>
                Conciliación
                {pendientes > 0 ? (
                  <Badge variant="warning" className="ml-2">{pendientes}</Badge>
                ) : null}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {/* P1-1: `|| !data` congelaba el esqueleto cuando la consulta fallaba. */}
      <AsyncBoundary
        isLoading={isLoading}
        isError={isError || (!isLoading && !data)}
        onRetry={() => void refetch()}
        skeleton={<KpiGridSkeleton count={4} heightClass="h-20" />}
        errorTitle="No se pudo cargar el resumen de tesorería"
      >
        {data ? (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant={data.tipo_cambio_usd ? "info" : "secondary"}>
                {data.tipo_cambio_usd
                  ? `TC DOF $${data.tipo_cambio_usd.toFixed(4)}${
                      data.tipo_cambio_fecha ? ` · ${formatFechaEs(data.tipo_cambio_fecha)}` : ""
                    }`
                  : "TC DOF no disponible"}
              </Badge>
            </div>

            {data.saldo_bancos_incompleto && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No hay tipo de cambio confiable: el saldo bancario total excluye{" "}
                  {Object.entries(data.saldos_por_moneda)
                    .filter(([moneda]) => moneda !== "MXN")
                    .map(([moneda, monto]) => `${formatCurrency(monto, moneda)} (${moneda})`)
                    .join(", ")}
                  .
                </AlertDescription>
              </Alert>
            )}

            {pendientes > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>
                    Hay <strong>{pendientes}</strong> movimiento{pendientes === 1 ? "" : "s"} bancario
                    {pendientes === 1 ? "" : "s"} sin conciliar.
                  </span>
                  <Link to={ROUTES.TESORERIA_CONCILIACION} className="text-accent hover:underline">
                    Ir a conciliación
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            <TesoreriaKpis data={data} />

            {data.cuentas.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Aún no hay cuentas bancarias.{" "}
                  <Link to={ROUTES.TESORERIA_CUENTAS} className="text-accent underline">
                    Da de alta una
                  </Link>{" "}
                  para ver el saldo real.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
              <TesoreriaFlujoChart />
              <TesoreriaFlujoMonedas flujo={data.flujo} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TesoreriaTopCartera
                titulo="Top 5 deudores (vencidos)"
                items={data.top_deudores}
                vacio="Sin facturas vencidas."
                tono="cobrar"
                totalVencido={data.cartera_vencida_total_mxn}
                countVencido={data.cartera_vencida_count}
                verTodoLabel="Ver cobranza"
                verTodoTo={ROUTES.CARTERA}
              />
              <TesoreriaTopCartera
                titulo="Top 5 proveedores por pagar"
                items={data.top_acreedores}
                vacio="Sin facturas vencidas."
                tono="pagar"
                totalVencido={data.cxp_vencidas_total_mxn}
                countVencido={data.cxp_vencidas_count}
                verTodoLabel="Ver antigüedad CxP"
                verTodoTo={ROUTES.COMPRAS_AGING}
              />
            </div>
          </>
        ) : null}
      </AsyncBoundary>
    </PageContainer>
  );
}
