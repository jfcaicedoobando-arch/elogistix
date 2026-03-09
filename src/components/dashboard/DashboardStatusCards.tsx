import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ESTADOS_FILTRO, type EstadoFiltro } from "@/hooks/useDashboardData";
import { ESTADO_CONFIG } from "./estadoConfig";
import { CalendarDays } from "lucide-react";

interface Props {
  conteoPorEstado: Record<EstadoFiltro, number>;
  totalActivos: number;
  filtroEstado: EstadoFiltro | null;
  onFiltroChange: (estado: EstadoFiltro | null) => void;
  isLoading: boolean;
  arribosEsteMes: number;
}

export function DashboardStatusCards({
  conteoPorEstado,
  totalActivos,
  filtroEstado,
  onFiltroChange,
  isLoading,
  arribosEsteMes,
}: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {ESTADOS_FILTRO.map((estado) => {
        const cfg = ESTADO_CONFIG[estado];
        const Icon = cfg.icon;
        const count = conteoPorEstado[estado];
        const pct = totalActivos ? (count / totalActivos) * 100 : 0;
        const selected = filtroEstado === estado;

        return (
          <Card
            key={estado}
            onClick={() => onFiltroChange(selected ? null : estado)}
            className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] border-2 ${
              selected ? `${cfg.border} ${cfg.glow}` : "border-transparent"
            }`}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div
                  className={`p-2 rounded-lg bg-gradient-to-br ${cfg.gradient}`}
                >
                  <Icon className="h-4 w-4 text-white" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <span className="text-3xl font-extrabold tracking-tight">
                    {count}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {estado}
              </p>
              <Progress value={pct} className="h-1.5" />
            </CardContent>
          </Card>
        );
      })}

      {/* Tarjeta informativa: Arribos este mes */}
      <Card className="border-2 border-transparent">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600">
              <CalendarDays className="h-4 w-4 text-white" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-10" />
            ) : (
              <span className="text-3xl font-extrabold tracking-tight">
                {arribosEsteMes}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Arribos este mes
          </p>
          <Progress value={100} className="h-1.5 [&>div]:bg-cyan-500" />
        </CardContent>
      </Card>
    </div>
  );
}
