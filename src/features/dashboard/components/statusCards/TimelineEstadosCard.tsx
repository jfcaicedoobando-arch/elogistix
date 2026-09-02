import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ESTADOS_FILTRO, type EstadoFiltro } from "@/features/dashboard/hooks";
import { getEstadoVisual } from "@/lib/ui/estadoConfig";
import { Hint } from "@/components/shared/Hint";

interface Props {
  conteoPorEstado: Record<EstadoFiltro, number>;
  isLoading: boolean;
}

export function TimelineEstadosCard({ conteoPorEstado, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden" data-testid="timeline-estados-card">
      <CardContent className="p-4 sm:p-6">
        {/* v13.301.64 · Auditoría 698×572: máscara de fade en el borde
            derecho para señalar que la tira es desplazable cuando el
            contenedor es más angosto que la tira (v13.823.24: el fade se
            mantiene hasta lg, porque en tablet la tira sigue desbordando). */}
        <div
          className="overflow-x-auto -mx-1 px-1 [scrollbar-width:thin] [mask-image:linear-gradient(to_right,black_0,black_calc(100%-24px),transparent_100%)] lg:[mask-image:none]"
        >
          <div className="flex items-start justify-between gap-2 sm:gap-3 min-w-[480px] sm:min-w-[600px] relative">

            {/* Armonización global: la línea arcoíris (info→warning→success) se
                sustituye por un separador neutro; el color se reserva para
                estados semánticos (alertas, vencidos). */}
            <div className="absolute top-5 sm:top-6 left-[10%] right-[10%] h-px bg-border" />

            {ESTADOS_FILTRO.map((estado, idx) => {
              const cfg = getEstadoVisual(estado);
              const Icon = cfg.icon;
              const count = conteoPorEstado[estado];

              return (
                <div key={estado} className="flex flex-col items-center relative z-10 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/embarques?estado=${encodeURIComponent(estado)}`)}
                    aria-label={`Ver embarques en estado ${estado} (${count})`}
                    className="
                      relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full
                      border border-border bg-card text-muted-foreground
                      transition-colors
                      hover:border-primary/40 hover:bg-primary/10 hover:text-primary cursor-pointer
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
                    "
                  >
                    <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
                  </button>


                  <div className="mt-1.5 sm:mt-2">
                    {isLoading ? (
                      <Skeleton className="h-6 w-7 sm:h-7 sm:w-8" />
                    ) : (
                      <span
                        data-e2e-mask="dynamic-count"
                        className="text-kpi tabular-nums tracking-tight text-foreground"
                      >
                        {count}
                      </span>
                    )}
                  </div>

                  {/* E-15 / v13.823.24: la etiqueta ya no se corta ("Por liqui…");
                      envuelve en dos renglones y conserva el Hint con el nombre
                      completo para foco y hover/tap. */}
                  <Hint label={estado}>
                    <span className="text-label font-medium mt-0.5 text-muted-foreground text-center leading-tight text-balance px-0.5 cursor-help">
                      {estado}
                    </span>
                  </Hint>


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
