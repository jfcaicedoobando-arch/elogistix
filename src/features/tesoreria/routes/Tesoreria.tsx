import { Card, CardContent } from "@/components/ui/card";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
import { Link } from "react-router-dom";
import { Wallet, ArrowRight, FileText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useResumenTesoreria } from "@/features/tesoreria/hooks";
import { formatCurrency } from "@/lib/formatters";
import { descargarPdf } from "@/pdf/render/descargarPdf";
// P12: ReporteTesoreriaDocument se carga dinámicamente en el handler.
import { PageContainer } from "@/components/shared/PageContainer";
import { withOrgPrefix } from "@/lib/filenames";
import { ROUTES } from "@/constants/routes";
import { todayLocalISO } from "@/lib/date/today";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { formatFechaEs } from "@/lib/formatters/dates";

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" | "danger" | "success" }) {
  const t = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent density="tight">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold tabular-nums ${t}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function Tesoreria() {
  const { data, isLoading, isError, refetch } = useResumenTesoreria();

  const handlePdf = async () => {
    if (!data) return;
    const fecha = todayLocalISO();
    const { ReporteTesoreriaDocument } = await import("@/pdf/documents/ReporteTesoreriaDocument");
    await descargarPdf(
      <ReporteTesoreriaDocument
        fechaCorte={fecha}
        resumen={data}
      />,
      await withOrgPrefix(`Reporte_Tesoreria_${fecha}.pdf`),
    );
  };


  return (
    <PageContainer>
      <PageHeader
        title="Tesorería"
        description="Saldo bancario, cartera y flujo esperado a 30 días"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePdf} disabled={!data}>
              <FileText className="h-4 w-4 mr-2" /> Reporte PDF
            </Button>
            <Button variant="outline" asChild>
              <Link to={ROUTES.TESORERIA_CUENTAS}><Wallet className="h-4 w-4 mr-2" /> Cuentas</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={ROUTES.TESORERIA_FLUJO}><TrendingUp className="h-4 w-4 mr-2" /> Flujo 90 días</Link>
            </Button>
            <Button asChild>
              <Link to={ROUTES.TESORERIA_CONCILIACION}>Conciliación <ArrowRight className="h-4 w-4 ml-2" /></Link>
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
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Saldos en bancos</h3>
              {data.tipo_cambio_usd ? (
                <Badge variant="info">
                  TC DOF ${data.tipo_cambio_usd.toFixed(4)}
                  {data.tipo_cambio_fecha ? ` · ${formatFechaEs(data.tipo_cambio_fecha)}` : ""}
                </Badge>
              ) : null}
            </div>
            {data.saldo_bancos_incompleto && (
              <Alert variant="warning" className="mb-2">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.cuentas.length === 0 ? (
                <Card><CardContent density="compact" className="text-sm text-muted-foreground">Sin cuentas. <Link to={ROUTES.TESORERIA_CUENTAS} className="text-accent underline">Da de alta una</Link>.</CardContent></Card>
              ) : data.cuentas.map((c) => (
                <Card key={c.id}>
                  <CardContent density="tight">
                    <p className="text-xs text-muted-foreground">{c.banco} · {c.alias}</p>
                    <p className="text-lg font-semibold tabular-nums">{formatCurrency(c.saldo, c.moneda)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Flujo esperado 30 días</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label="Por cobrar MXN" value={formatCurrency(data.flujo.por_cobrar_mxn, "MXN")} tone="success" />
              <Stat label="Por cobrar USD" value={formatCurrency(data.flujo.por_cobrar_usd, "USD")} tone="success" />
              <Stat label="Por pagar MXN" value={formatCurrency(data.flujo.por_pagar_mxn, "MXN")} tone="warn" />
              <Stat label="Por pagar USD" value={formatCurrency(data.flujo.por_pagar_usd, "USD")} tone="warn" />
              <Stat label="Flujo neto MXN" value={formatCurrency(data.flujo.flujo_neto_mxn, "MXN")} tone={data.flujo.flujo_neto_mxn >= 0 ? "success" : "danger"} />
              <Stat label="Flujo neto USD" value={formatCurrency(data.flujo.flujo_neto_usd, "USD")} tone={data.flujo.flujo_neto_usd >= 0 ? "success" : "danger"} />
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent density="compact">
                <h3 className="text-sm font-semibold mb-3">Top 5 deudores (vencidos)</h3>
                {data.top_deudores.length === 0
                  ? <p className="text-sm text-muted-foreground">Sin facturas vencidas 🎉</p>
                  : (
                    <ul className="space-y-1.5 text-sm">
                      {data.top_deudores.map((d, i) => (
                        <li key={i} className="flex justify-between border-b last:border-0 pb-1.5">
                          <span className="truncate flex-1">{d.nombre}</span>
                          <span className="tabular-nums text-destructive font-medium ml-2">{formatCurrency(d.saldo, d.moneda)}</span>
                          <span className="text-xs text-muted-foreground ml-2 w-14 text-right">{d.dias}d</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </CardContent>
            </Card>
            <Card>
              <CardContent density="compact">
                <h3 className="text-sm font-semibold mb-3">Top 5 proveedores por pagar</h3>
                {data.top_acreedores.length === 0
                  ? <p className="text-sm text-muted-foreground">Sin facturas próximas a vencer.</p>
                  : (
                    <ul className="space-y-1.5 text-sm">
                      {data.top_acreedores.map((d, i) => (
                        <li key={i} className="flex justify-between border-b last:border-0 pb-1.5">
                          <span className="truncate flex-1">{d.nombre}</span>
                          <span className="tabular-nums text-warning font-medium ml-2">{formatCurrency(d.saldo, d.moneda)}</span>
                          <span className="text-xs text-muted-foreground ml-2 w-14 text-right">{d.dias}d</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </CardContent>
            </Card>
          </div>
        </>
        ) : null}
      </AsyncBoundary>
    </PageContainer>
  );
}
