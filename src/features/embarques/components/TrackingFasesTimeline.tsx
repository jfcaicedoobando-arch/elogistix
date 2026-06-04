import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { calcularFasesEmbarque, type EmbarqueFasesInput, type FaseEmbarque } from "@/lib/domain/embarqueFases";
import { cn } from "@/lib/utils";

interface Props {
  embarque: EmbarqueFasesInput;
  cotizacionCreatedAt?: string | null;
}

function getCirculoClass(estado: FaseEmbarque["estado"]): string {
  if (estado === "actual") return "bg-accent text-accent-foreground ring-4 ring-accent/20";
  if (estado === "completada") return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
}

function getConectorClass(siguiente: FaseEmbarque["estado"]): string {
  if (siguiente === "completada" || siguiente === "actual") return "bg-accent";
  return "bg-border";
}

function getLabelClass(estado: FaseEmbarque["estado"]): string {
  if (estado === "pendiente") return "text-muted-foreground";
  return "text-foreground font-medium";
}

export function TrackingFasesTimeline({ embarque, cotizacionCreatedAt }: Props) {
  const fases = calcularFasesEmbarque(embarque, cotizacionCreatedAt);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Avance del Embarque</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop: horizontal stepper */}
        <div className="hidden md:flex items-start">
          {fases.map((fase, i) => (
            <div key={fase.id} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center min-w-[88px]">
                <div className={cn(
                  "h-10 w-10 rounded-full border-2 border-background flex items-center justify-center text-base shrink-0 transition-colors",
                  getCirculoClass(fase.estado),
                )}>
                  {fase.icono}
                </div>
                <div className="text-center mt-2 px-1">
                  <p className={cn("text-xs", getLabelClass(fase.estado))}>{fase.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {fase.fecha ? formatDate(fase.fecha, "dd MMM yyyy") : "—"}
                  </p>
                </div>
              </div>
              {i < fases.length - 1 && (
                <div className={cn("h-0.5 flex-1 mt-5 mx-1", getConectorClass(fases[i + 1].estado))} />
              )}
            </div>
          ))}
        </div>

        {/* Móvil: vertical stepper */}
        <div className="md:hidden relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {fases.map((fase) => (
              <div key={fase.id} className="relative pl-14">
                <div className={cn(
                  "absolute left-0 top-0 h-10 w-10 rounded-full border-2 border-background flex items-center justify-center text-base transition-colors",
                  getCirculoClass(fase.estado),
                )}>
                  {fase.icono}
                </div>
                <p className={cn("text-sm", getLabelClass(fase.estado))}>{fase.label}</p>
                <p className="text-xs text-muted-foreground">
                  {fase.fecha ? formatDate(fase.fecha, "dd MMM yyyy") : "Pendiente"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
