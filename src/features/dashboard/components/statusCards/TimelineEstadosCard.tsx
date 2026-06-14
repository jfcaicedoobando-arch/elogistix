import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ESTADOS_FILTRO, type EstadoFiltro } from "@/features/dashboard/hooks";
import { ESTADO_CONFIG } from "@/components/shared/utils/estadoConfig";

interface Props {
  conteoPorEstado: Record<EstadoFiltro, number>;
  isLoading: boolean;
}

export function TimelineEstadosCard({ conteoPorEstado, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] relative">
            <div className="absolute top-6 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-info via-warning to-emerald-500 opacity-30" />

            {ESTADOS_FILTRO.map((estado, idx) => {
              const cfg = ESTADO_CONFIG[estado];
              const Icon = cfg.icon;
              const count = conteoPorEstado[estado];

              return (
                <div key={estado} className="flex flex-col items-center relative z-10">
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

                  <div className="mt-2">
                    {isLoading ? (
                      <Skeleton className="h-7 w-8" />
                    ) : (
                      <span className="text-2xl font-extrabold tracking-tight text-foreground">
                        {count}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-medium mt-0.5 text-muted-foreground">
                    {estado}
                  </span>

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
  );
}
