import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ESTADOS_FILTRO, type EstadoFiltro } from "@/hooks/dashboard/useDashboardData";
import { ESTADO_CONFIG } from "@/lib/ui/estadoConfig";
import { CalendarDays, TrendingUp, Ship, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";

interface ArribosEsteMes {
  total: number;
  yaLlegaron: number;
  enCamino: number;
  profitUSD: number;
}

interface Props {
  conteoPorEstado: Record<EstadoFiltro, number>;
  totalActivos: number;
  isLoading: boolean;
  arribosEsteMes: ArribosEsteMes;
}

export function DashboardStatusCards({
  conteoPorEstado,
  isLoading,
  arribosEsteMes,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* CAMBIO 1 — Línea de tiempo horizontal */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between min-w-[600px] relative">
              {/* Línea conectora de fondo */}
              <div className="absolute top-6 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-info via-warning to-emerald-500 opacity-30" />

              {ESTADOS_FILTRO.map((estado, idx) => {
                const cfg = ESTADO_CONFIG[estado];
                const Icon = cfg.icon;
                const count = conteoPorEstado[estado];

                return (
                  <div key={estado} className="flex flex-col items-center relative z-10">
                    {/* Nodo — clic lleva a /embarques con filtro de estado preaplicado */}
                    <button
                      type="button"
                      onClick={() => navigate(`/embarques?estado=${encodeURIComponent(estado)}`)}
                      aria-label={`Ver embarques en estado ${estado} (${count})`}
                      title={`Ver embarques en estado ${estado} (${count})`}
                      className={`
                        relative flex items-center justify-center w-12 h-12 rounded-full
                        bg-gradient-to-br ${cfg.gradient}
                        transition-all duration-300 ease-out
                        hover:scale-110 hover:shadow-lg cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
                        ring-1 ring-border/20
                      `}
                    >
                      <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                    </button>

                    {/* Conteo */}
                    <div className="mt-2">
                      {isLoading ? (
                        <Skeleton className="h-7 w-8" />
                      ) : (
                        <span className="text-2xl font-extrabold tracking-tight text-foreground">
                          {count}
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    <span className="text-[11px] font-medium mt-0.5 text-muted-foreground">
                      {estado}
                    </span>

                    {/* Flecha conectora (excepto último) */}
                    {idx < ESTADOS_FILTRO.length - 1 && (
                      <div className="absolute top-6 left-full w-full flex items-center justify-center pointer-events-none">
                        <div className="w-full h-0.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CAMBIO 2 — Indicador de arribos + profit */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4">
            {/* Título */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600">
                <CalendarDays className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-foreground">Arribos este mes</span>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 flex-1">
              <div className="text-center">
                {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                  <span className="text-xl font-bold text-foreground tabular-nums">{arribosEsteMes.total}</span>
                )}
                <p className="text-[11px] text-muted-foreground font-medium">Total</p>
              </div>

              <div className="text-center">
                {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                  <div className="flex items-center gap-1 justify-center">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="text-xl font-bold text-success tabular-nums">{arribosEsteMes.yaLlegaron}</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground font-medium">Ya llegaron</p>
              </div>

              <div className="text-center">
                {isLoading ? <Skeleton className="h-6 w-8 mx-auto" /> : (
                  <div className="flex items-center gap-1 justify-center">
                    <Ship className="h-3.5 w-3.5 text-warning" />
                    <span className="text-xl font-bold text-warning tabular-nums">{arribosEsteMes.enCamino}</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground font-medium">En camino</p>
              </div>

              {/* Profit */}
              <div className="text-center">
                {isLoading ? <Skeleton className="h-6 w-20 mx-auto" /> : (
                  <div className="flex items-center gap-1 justify-center">
                    <TrendingUp className={`h-3.5 w-3.5 ${arribosEsteMes.profitUSD >= 0 ? "text-success" : "text-destructive"}`} />
                    <span
                      className={`text-base sm:text-xl font-bold tabular-nums whitespace-nowrap ${arribosEsteMes.profitUSD >= 0 ? "text-success" : "text-destructive"}`}
                      title={formatCurrency(arribosEsteMes.profitUSD, "USD")}
                    >
                      {formatCurrencyCompact(arribosEsteMes.profitUSD, "USD")}
                    </span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground font-medium">Profit USD proyectado</p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-2 xl:w-40 shrink-0">
              <Progress
                value={arribosEsteMes.total > 0 ? (arribosEsteMes.yaLlegaron / arribosEsteMes.total) * 100 : 0}
                className="h-2 flex-1 [&>div]:bg-kpi-secondary"
              />
              <span className="text-xs text-muted-foreground font-medium w-8 text-right">
                {arribosEsteMes.total > 0
                  ? Math.round((arribosEsteMes.yaLlegaron / arribosEsteMes.total) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
