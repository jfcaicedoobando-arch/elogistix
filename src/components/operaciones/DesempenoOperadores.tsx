import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import type { OperadorData } from "@/hooks/operaciones/useOperacionesData";
import { useDesempenoChartData, ESTADOS_KEYS } from "@/hooks/operaciones/useDesempenoChartData";
import { ESTADO_COLOR } from "./desempenoVisuals";
import { OperadorCard } from "./OperadorCard";

interface Props {
  operadores: OperadorData[];
  isLoading: boolean;
}

export function DesempenoOperadores({ operadores, isLoading }: Props) {
  const chartData = useDesempenoChartData(operadores);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Desempeño por Operador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[300px] w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (operadores.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
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
    <Card className="rounded-2xl shadow-sm border-0 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Desempeño por Operador
          <Badge variant="secondary" className="ml-1 text-[10px]">
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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="nombre"
                tick={{ fontSize: 11 }}
                angle={-25}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <RechartsTooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {ESTADOS_KEYS.map((estado) => (
                <Bar
                  key={estado}
                  dataKey={estado}
                  stackId="estados"
                  fill={ESTADO_COLOR[estado]}
                  radius={estado === "Cerrado" ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
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
