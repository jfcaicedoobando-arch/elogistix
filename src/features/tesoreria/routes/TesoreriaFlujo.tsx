/**
 * Flujo de caja proyectado a 90 días.
 */
import { lazy, Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { Card, CardContent } from "@/components/ui/card";

import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { KpiCard } from "@/components/shared/KpiCard";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { formatCurrency } from "@/lib/formatters/numbers";
import { useFlujoProyectado } from "@/features/tesoreria/hooks";
import { PageContainer } from "@/components/shared/PageContainer";

const GraficoFlujoProyectado = lazy(() => import("@/features/tesoreria/components/GraficoFlujoProyectado"));
const TablaFlujoSemanal = lazy(() => import("@/features/tesoreria/components/TablaFlujoSemanal"));


export default function TesoreriaFlujo() {
  const { data, isLoading } = useFlujoProyectado(90);

  return (
    <PageContainer>
      <DetailHeader
        backTo="/tesoreria"
        backLabel="Volver a Tesorería"
        title="Flujo de caja proyectado · 90 días"
        subtitle="Proyección semanal de entradas (CxC) y salidas (CxP + comisiones) sobre vencimientos."
      />


      {isLoading || !data ? (
        <KpiGridSkeleton count={4} heightClass="h-20" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Saldo hoy (MXN aprox)" value={formatCurrency(data.saldo_inicial_mxn, "MXN")} />
            <KpiCard label="Entradas 90 días" value={formatCurrency(data.total_entradas_mxn, "MXN")} variant="success" />
            <KpiCard label="Salidas 90 días" value={formatCurrency(data.total_salidas_mxn, "MXN")} variant="warning" />
            <KpiCard
              label="Saldo final proyectado"
              value={formatCurrency(data.saldo_final_mxn, "MXN")}
              variant={data.saldo_final_mxn >= 0 ? "success" : "destructive"}
            />
          </div>

          {data.alertas_negativas > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent density="tight" className="flex items-center gap-2 text-sm">
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
              <h3 className="text-sm font-semibold mb-3">Flujo semanal (MXN)</h3>
              <Suspense fallback={<ChartSkeleton height={288} />}>
                <GraficoFlujoProyectado semanas={data.semanas} />
              </Suspense>
            </CardContent>
          </Card>

          <Suspense fallback={<ChartSkeleton height={256} detailed={false} />}>
            <TablaFlujoSemanal semanas={data.semanas} />
          </Suspense>
        </>
      )}
    </PageContainer>
  );
}
