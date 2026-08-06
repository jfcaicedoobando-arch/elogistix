import { lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { Users } from "lucide-react";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import type { OperadorData } from "@/features/operaciones/hooks";
import { useDesempenoChartData } from "@/features/operaciones/hooks";
import { OperadorCard } from "./OperadorCard";

// Lazy: difiere recharts fuera del TTI de la página Operaciones.
const DesempenoOperadoresChart = lazy(() => import("./DesempenoOperadoresChart"));


interface Props {
  operadores: OperadorData[];
  isLoading: boolean;
}

export function DesempenoOperadores({ operadores, isLoading }: Props) {
  const chartData = useDesempenoChartData(operadores);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Desempeño por Operador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ChartSkeleton height={300} />
          <KpiGridSkeleton count={3} heightClass="h-48" desktopCols={3} />
        </CardContent>
      </Card>
    );
  }

  if (operadores.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Desempeño por Operador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Sin datos de operadores
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Desempeño por Operador
          <Badge variant="secondary" className="ml-1 text-2xs">
            {operadores.length} {operadores.length === 1 ? "operador" : "operadores"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gráfico resumen general */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Comparativa de carga de trabajo
          </p>
          <Suspense fallback={<ChartSkeleton height={320} />}>
            <DesempenoOperadoresChart data={chartData} />
          </Suspense>
        </div>


        {/* Tarjetas por operador */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {operadores.map((op) => (
            <OperadorCard key={op.nombre} operador={op} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
