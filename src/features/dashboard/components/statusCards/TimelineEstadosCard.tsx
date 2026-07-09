import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ESTADOS_FILTRO, type EstadoFiltro } from "@/features/dashboard/hooks";
import { ESTADO_CONFIG } from "@/lib/ui/estadoConfig";

interface Props {
  conteoPorEstado: Record<EstadoFiltro, number>;
  isLoading: boolean;
}

export function TimelineEstadosCard({ conteoPorEstado, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-[480px] sm:min-w-[600px] relative">
            <div className="absolute top-5 sm:top-6 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-info via-warning to-success opacity-30" />

            {ESTADOS_FILTRO.map((estado, idx) => {
              const cfg = ESTADO_CONFIG[estado];
              const Icon = cfg.icon;
              const count = conteoPorEstado[estado];

              return (
                <div key={estado} className="flex flex-col items-center relative z-10 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/embarques?estado=${encodeURIComponent(estado)}`)}
                    aria-label={`Ver embarques en estado ${estado} (${count})`}
                    title={`Ver embarques en estado ${estado} (${count})`}
                    className={`
                      relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full
                      bg-gradient-to-br ${cfg.gradient}
                      transition-all duration-300 ease-out
                      hover:scale-110 hover:shadow-lg cursor-pointer
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
                      ring-1 ring-border/20
                    `}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" aria-hidden="true" />
                  </button>

                  <div className="mt-1.5 sm:mt-2">
                    {isLoading ? (
                      <Skeleton className="h-6 w-7 sm:h-7 sm:w-8" />
                    ) : (
                      <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                        {count}
                      </span>
                    )}
                  </div>

                  <span className="text-2xs sm:text-[11px] font-medium mt-0.5 text-muted-foreground text-center truncate max-w-full px-1">
                    {estado}
                  </span>

                  {idx < ESTADOS_FILTRO.length - 1 && (
                    <div className="absolute top-5 sm:top-6 left-full w-full flex items-center justify-center pointer-events-none">
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
  );
}
