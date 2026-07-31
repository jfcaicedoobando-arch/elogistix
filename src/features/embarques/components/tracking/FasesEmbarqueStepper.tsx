import { useMemo } from "react";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  calcularFasesEmbarque,
  esEtaVencida,
  type EmbarqueFasesInput,
  type FaseEmbarque,
} from "@/features/embarques/domain/embarqueFases";
import { FaseNodo } from "./FaseNodo";

interface Props {
  embarque: EmbarqueFasesInput;
  cotizacionCreatedAt?: string | null;
  /**
   * `compacta`: una sola fila para el tab Resumen.
   * `completa`: stepper con etiquetas y fechas para el tab Tracking.
   */
  variant?: "compacta" | "completa";
}

/** Texto de fecha de la fase: real, estimada o pendiente. */
function textoFecha(fase: FaseEmbarque): string {
  if (!fase.fecha) return "Pendiente";
  const fecha = formatDate(fase.fecha, "dd MMM");
  return fase.estado === "pendiente" ? `est. ${fecha}` : fecha;
}

function tituloNodo(fase: FaseEmbarque): string {
  const fecha = fase.fecha ? formatDate(fase.fecha, "dd/MM/yyyy") : "sin fecha";
  return `${fase.label} — ${fecha}`;
}

function claseConector(siguiente: FaseEmbarque["estado"]): string {
  if (siguiente === "completada") return "bg-accent";
  // Tramo hacia la fase actual: relleno a la mitad para señalar avance parcial.
  if (siguiente === "actual") return "bg-gradient-to-r from-accent to-border";
  return "bg-border";
}

function useFases(embarque: EmbarqueFasesInput, cotizacionCreatedAt?: string | null) {
  return useMemo(
    () => calcularFasesEmbarque(embarque, cotizacionCreatedAt),
    [embarque, cotizacionCreatedAt],
  );
}

function StepperCompacto({ fases, enRiesgo }: { fases: FaseEmbarque[]; enRiesgo: boolean }) {
  const idxActual = Math.max(fases.findIndex((f) => f.estado === "actual"), 0);
  const actual = fases[idxActual];
  const siguiente = fases[idxActual + 1];
  const progreso = fases.length > 1 ? (idxActual / (fases.length - 1)) * 100 : 0;

  return (
    <div data-testid="fases-stepper" data-variant="compacta">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Paso {idxActual + 1} de {fases.length}
          </span>
          <span className="text-sm font-semibold truncate">{actual?.label}</span>
        </div>
        {siguiente && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Siguiente: <span className="text-foreground/80">{siguiente.label}</span>
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center">
        {fases.map((fase, i) => (
          <div key={fase.id} className="flex items-center flex-1 last:flex-none">
            <FaseNodo
              iconoId={fase.iconoId}
              estado={fase.estado}
              enRiesgo={enRiesgo}
              tamano="sm"
              titulo={tituloNodo(fase)}
            />
            {i < fases.length - 1 && (
              <div className={cn("h-1 flex-1 mx-1 rounded-full", claseConector(fases[i + 1].estado))} />
            )}
          </div>
        ))}
      </div>

      <div
        className="sr-only"
        role="progressbar"
        aria-valuenow={progreso}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {actual?.label} — {Math.round(progreso)}%
      </div>
    </div>
  );
}

function StepperCompleto({ fases, enRiesgo }: { fases: FaseEmbarque[]; enRiesgo: boolean }) {
  return (
    <div data-testid="fases-stepper" data-variant="completa">
      {/* Escritorio: horizontal, con scroll contenido si el ancho aprieta */}
      <div className="hidden md:block overflow-x-auto">
        <div className="flex items-start min-w-[640px]">
          {fases.map((fase, i) => (
            <div key={fase.id} className="flex items-start flex-1 last:flex-none">
              <div className="flex flex-col items-center min-w-[76px]">
                <FaseNodo
                  iconoId={fase.iconoId}
                  estado={fase.estado}
                  enRiesgo={enRiesgo}
                  titulo={tituloNodo(fase)}
                />
                <div className="text-center mt-2 px-1">
                  <p className={cn(
                    "text-xs",
                    fase.estado === "pendiente" ? "text-muted-foreground" : "text-foreground font-medium",
                  )}>
                    {fase.label}
                  </p>
                  <p className="text-2xs text-muted-foreground mt-0.5">{textoFecha(fase)}</p>
                </div>
              </div>
              {i < fases.length - 1 && (
                <div className={cn("h-0.5 flex-1 mt-4 mx-1 rounded-full", claseConector(fases[i + 1].estado))} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Móvil: vertical */}
      <div className="md:hidden relative">
        <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-border" />
        <div className="space-y-4">
          {fases.map((fase) => (
            <div key={fase.id} className="relative pl-12">
              <div className="absolute left-0 top-0">
                <FaseNodo
                  iconoId={fase.iconoId}
                  estado={fase.estado}
                  enRiesgo={enRiesgo}
                  titulo={tituloNodo(fase)}
                />
              </div>
              <p className={cn(
                "text-sm",
                fase.estado === "pendiente" ? "text-muted-foreground" : "text-foreground font-medium",
              )}>
                {fase.label}
              </p>
              <p className="text-xs text-muted-foreground">{textoFecha(fase)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Stepper único de fases del embarque. Resumen y Tracking comparten la misma
 * fuente de verdad (`calcularFasesEmbarque`) y sólo cambian de densidad.
 */
export function FasesEmbarqueStepper({ embarque, cotizacionCreatedAt, variant = "completa" }: Props) {
  const fases = useFases(embarque, cotizacionCreatedAt);
  const enRiesgo = esEtaVencida(embarque);

  return variant === "compacta"
    ? <StepperCompacto fases={fases} enRiesgo={enRiesgo} />
    : <StepperCompleto fases={fases} enRiesgo={enRiesgo} />;
}
