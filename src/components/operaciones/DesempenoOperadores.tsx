import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, User, Anchor, Ship, Container, Warehouse, PackageCheck, ChevronRight } from "lucide-react";
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
import type { OperadorData, DesgloseEstados } from "@/hooks/useOperacionesData";

const ESTADOS_KEYS: (keyof DesgloseEstados)[] = [
  "Confirmado",
  "En Tránsito",
  "Llegada",
  "En Proceso",
  "Cerrado",
];

// Tokens semánticos: usamos colores del design system mediante variables CSS
const ESTADO_COLOR: Record<keyof DesgloseEstados, string> = {
  Confirmado: "hsl(var(--info))",
  "En Tránsito": "hsl(var(--warning))",
  Llegada: "hsl(199 89% 48%)",       // cyan
  "En Proceso": "hsl(262 83% 58%)",   // violet
  Cerrado: "hsl(160 84% 39%)",        // emerald
};

const ESTADO_ICON: Record<keyof DesgloseEstados, typeof Anchor> = {
  Confirmado: Anchor,
  "En Tránsito": Ship,
  Llegada: Container,
  "En Proceso": Warehouse,
  Cerrado: PackageCheck,
};

interface Props {
  operadores: OperadorData[];
  isLoading: boolean;
}

export function DesempenoOperadores({ operadores, isLoading }: Props) {
  const chartData = useMemo(
    () =>
      operadores.map((op) => ({
        nombre: op.nombre,
        Confirmado: op.desgloseEstados.Confirmado,
        "En Tránsito": op.desgloseEstados["En Tránsito"],
        Llegada: op.desgloseEstados.Llegada,
        "En Proceso": op.desgloseEstados["En Proceso"],
        Cerrado: op.desgloseEstados.Cerrado,
      })),
    [operadores]
  );

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

const TOP_CLIENTES = 5;

function OperadorCard({ operador }: { operador: OperadorData }) {
  const totalDesglose = useMemo(
    () => ESTADOS_KEYS.reduce((s, k) => s + operador.desgloseEstados[k], 0),
    [operador]
  );

  // clientesDesglose ya viene ordenado por cantidad desc desde useOperacionesData
  const clientesTop = operador.clientesDesglose.slice(0, TOP_CLIENTES);
  const clientesRestantes = Math.max(operador.clientesDesglose.length - TOP_CLIENTES, 0);

  return (
    <div className="rounded-xl border bg-background p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{operador.nombre}</p>
            <p className="text-[11px] text-muted-foreground">
              {operador.cargasActivas} embarques activos
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {operador.clientes.length} {operador.clientes.length === 1 ? "cliente" : "clientes"}
        </Badge>
      </div>

      {/* Desglose por estado */}
      <div className="space-y-1.5">
        {ESTADOS_KEYS.map((estado) => {
          const count = operador.desgloseEstados[estado];
          const Icon = ESTADO_ICON[estado];
          const pct = totalDesglose > 0 ? (count / totalDesglose) * 100 : 0;
          return (
            <div key={estado} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3 w-3" style={{ color: ESTADO_COLOR[estado] }} />
                  {estado}
                </span>
                <span className="font-semibold tabular-nums">{count}</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ESTADO_COLOR[estado],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Clientes */}
      <div className="pt-2 border-t border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Clientes
        </p>
        {operador.clientesDesglose.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Sin clientes activos</p>
        ) : (
          <>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {clientesTop.map((c) => (
                <li
                  key={c.nombre}
                  className="flex items-center justify-between text-[11px] gap-2"
                >
                  <span className="flex items-center gap-1 min-w-0 text-foreground">
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{c.nombre}</span>
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] h-4 px-1.5 shrink-0 tabular-nums"
                  >
                    {c.cantidad}
                  </Badge>
                </li>
              ))}
            </ul>
            {clientesRestantes > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 pl-4">
                +{clientesRestantes} {clientesRestantes === 1 ? "cliente más" : "clientes más"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
