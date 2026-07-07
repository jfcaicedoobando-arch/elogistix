/**
 * Flujo de caja proyectado a 90 días.
 */
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { formatCurrency } from "@/lib/formatters/numbers";
import { useFlujoProyectado } from "@/features/tesoreria/hooks";
import { PageContainer } from "@/components/shared/PageContainer";

const GraficoFlujoProyectado = lazy(() => import("@/features/tesoreria/components/GraficoFlujoProyectado"));
const TablaFlujoSemanal = lazy(() => import("@/features/tesoreria/components/TablaFlujoSemanal"));

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" | "success" | "warn" }) {
  const tt = tone === "danger" ? "text-destructive" : tone === "success" ? "text-success" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent density="tight">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold tabular-nums ${tt}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function TesoreriaFlujo() {
  const { data, isLoading } = useFlujoProyectado(90);

  return (
    <PageContainer>
      <PageHeader
        title="Flujo de caja proyectado · 90 días"
        description="Proyección semanal de entradas (CxC) y salidas (CxP + comisiones) sobre vencimientos."
        actions={
          <Button variant="outline" asChild>
            <Link to="/tesoreria"><ArrowLeft className="h-4 w-4 mr-2" /> Tesorería</Link>
          </Button>
        }
      />

      {isLoading || !data ? (
        <KpiGridSkeleton count={4} heightClass="h-20" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi label="Saldo hoy (MXN aprox)" value={formatCurrency(data.saldo_inicial_mxn, "MXN")} />
            <Kpi label="Entradas 90 días" value={formatCurrency(data.total_entradas_mxn, "MXN")} tone="success" />
            <Kpi label="Salidas 90 días" value={formatCurrency(data.total_salidas_mxn, "MXN")} tone="warn" />
            <Kpi
              label="Saldo final proyectado"
              value={formatCurrency(data.saldo_final_mxn, "MXN")}
              tone={data.saldo_final_mxn >= 0 ? "success" : "danger"}
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
