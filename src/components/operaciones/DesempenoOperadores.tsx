import { memo, useMemo, useState } from "react";
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
import { useDesempenoChartData, ESTADOS_KEYS } from "@/hooks/useDesempenoChartData";

// Tokens semánticos: usamos colores del design system mediante variables CSS
const ESTADO_COLOR: Record<keyof DesgloseEstados, string> = {
  Confirmado: "hsl(var(--info))",
  "En Tránsito": "hsl(var(--warning))",
  Llegada: "hsl(var(--state-llegada))",
  "En Proceso": "hsl(var(--state-en-proceso))",
  Cerrado: "hsl(var(--state-cerrado))",
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

const TOP_CLIENTES = 5;

const OperadorCard = memo(function OperadorCard({ operador }: { operador: OperadorData }) {
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
            <ul className="space-y-0.5 max-h-56 overflow-y-auto">
              {clientesTop.map((c) => (
                <ClienteExpandible key={c.nombre} cliente={c} />
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
});

const ClienteExpandible = memo(function ClienteExpandible({ cliente }: { cliente: OperadorData["clientesDesglose"][number] }) {
  const [open, setOpen] = useState(false);
  const estadosConValor = ESTADOS_KEYS.filter((e) => cliente.desgloseEstados[e] > 0);

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full group">
          <div className="flex items-center justify-between text-[11px] gap-2 py-1 px-1 rounded hover:bg-muted/60 transition-colors">
            <span className="flex items-center gap-1 min-w-0 text-foreground">
              <ChevronRight
                className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  open ? "rotate-90" : ""
                }`}
              />
              <span className="truncate">{cliente.nombre}</span>
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 shrink-0 tabular-nums"
            >
              {cliente.cantidad}
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="ml-5 mt-1 mb-1.5 pl-2 border-l border-border space-y-1">
            {estadosConValor.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic py-1">Sin desglose</p>
            ) : (
              estadosConValor.map((estado) => {
                const Icon = ESTADO_ICON[estado];
                return (
                  <div
                    key={estado}
                    className="flex items-center justify-between text-[10px] gap-2"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="h-3 w-3" style={{ color: ESTADO_COLOR[estado] }} />
                      {estado}
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: ESTADO_COLOR[estado] }}
                    >
                      {cliente.desgloseEstados[estado]}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
});
