import { useDocumentTitle } from "@/hooks/shared/useDocumentTitle";
/**
 * Flujo de caja proyectado a 90 días.
 */
import { AvisoVencidosFueraProyeccion } from "@/features/tesoreria/components/AvisoVencidosFueraProyeccion";
import { lazy, Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";
import { Card, CardContent } from "@/components/ui/card";

import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { formatCurrency } from "@/lib/formatters/numbers";
import { useFlujoProyectado } from "@/features/tesoreria/hooks";
import { PageContainer } from "@/components/shared/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatFechaEs } from "@/lib/formatters/dates";
import { SectionHeading } from "@/components/shared/SectionHeading";

const GraficoFlujoProyectado = lazy(() => import("@/features/tesoreria/components/GraficoFlujoProyectado"));
const TablaFlujoSemanal = lazy(() => import("@/features/tesoreria/components/TablaFlujoSemanal"));


export default function TesoreriaFlujo() {
  useDocumentTitle("Flujo de caja proyectado");
  const { data, isLoading, error, refetch } = useFlujoProyectado(90);
  const volver = useVolver("/tesoreria");

  return (
    <PageContainer>
      <DetailHeader
        backTo={volver}
        backLabel="Volver a Tesorería"
        title="Flujo de caja proyectado · 90 días"
        subtitle="Proyección semanal de entradas (CxC) y salidas (CxP + comisiones) sobre vencimientos."
      />


      {error ? (
        <ErrorStateInline
          message={getErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : isLoading || !data ? (
        <LoadingState
          label="Cargando flujo proyectado…"
          timeoutMs={60_000}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {data.tipo_cambio_usd ? (
            <div className="flex flex-col gap-1 sm:items-end">
              <Badge variant="info">
                TC DOF saldo inicial USD/MXN {data.tipo_cambio_usd.toFixed(4)}
                {data.tipo_cambio_fecha ? ` · ${formatFechaEs(data.tipo_cambio_fecha)}` : ""}
              </Badge>
            </div>
          ) : null}
          <p className="text-body-sm text-muted-foreground">
            El TC DOF convierte los saldos bancarios iniciales en moneda extranjera.
            Cada entrada y salida usa el tipo de cambio de su documento; el detalle muestra esa conversión.
          </p>

          {!data.saldo_inicial_disponible && (
            <Alert>
              <AlertDescription>
                Saldo inicial no disponible: no hay cuentas bancarias configuradas.
                Se muestran entradas, salidas y flujo neto; no se puede determinar el saldo bancario proyectado.
              </AlertDescription>
            </Alert>
          )}

          {data.saldo_incompleto && (
            <Alert variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No hay tipo de cambio confiable: el flujo proyectado excluye{" "}
                {Object.entries(data.excluido_por_moneda)
                  .map(([moneda, monto]) => formatCurrency(monto, moneda))
                  .join(", ")}
                .
              </AlertDescription>
            </Alert>
          )}

          <AvisoVencidosFueraProyeccion resumen={data.vencidos_fuera_proyeccion} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Saldo hoy (MXN aprox)" value={data.saldo_inicial_disponible ? formatCurrency(data.saldo_inicial_mxn, "MXN") : "No disponible"} />
            <KpiCard label="Entradas 90 días" value={formatCurrency(data.total_entradas_mxn, "MXN")} variant="success" />
            <KpiCard label="Salidas 90 días" value={formatCurrency(data.total_salidas_mxn, "MXN")} variant="warning" />
            <KpiCard
              label="Saldo final proyectado"
              value={data.saldo_inicial_disponible ? formatCurrency(data.saldo_final_mxn, "MXN") : "No disponible"}
              variant={!data.saldo_inicial_disponible ? "default" : data.saldo_final_mxn >= 0 ? "success" : "destructive"}
            />
          </div>

          {data.saldo_inicial_disponible && data.alertas_negativas > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent density="tight" className="flex items-center gap-2 text-body">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span>
                  <strong>{data.alertas_negativas}</strong> semana{data.alertas_negativas === 1 ? "" : "s"} con saldo proyectado negativo.
                  Revisa cobranza o reprograma pagos.
                </span>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent density="compact">
              <SectionHeading className="mb-3">Flujo semanal (MXN)</SectionHeading>
              <Suspense fallback={<ChartSkeleton height={288} />}>
                <GraficoFlujoProyectado semanas={data.semanas} saldoDisponible={data.saldo_inicial_disponible} />
              </Suspense>
            </CardContent>
          </Card>

          <Suspense fallback={<ChartSkeleton height={256} detailed={false} />}>
            <TablaFlujoSemanal semanas={data.semanas} saldoDisponible={data.saldo_inicial_disponible} />
          </Suspense>
        </>
      )}
    </PageContainer>
  );
}
