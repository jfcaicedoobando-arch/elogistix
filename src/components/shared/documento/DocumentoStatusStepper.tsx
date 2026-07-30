/**
 * Stepper de ciclo de vida de un documento financiero (estilo Odoo).
 * Muestra los pasos en orden y resalta el actual; si el documento terminó
 * fuera del flujo feliz (cancelada, sustituida, rechazada) muestra una
 * sola píldora en tono destructivo.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoDocumentoResumen } from "@/lib/domain/documentoEstados";

interface Props {
  resumen: EstadoDocumentoResumen;
  className?: string;
}

export function DocumentoStatusStepper({ resumen, className }: Props) {
  if (resumen.terminal) {
    return (
      <div
        className={cn("flex items-center gap-2", className)}
        aria-label={`Estado: ${resumen.etiquetaTerminal}`}
      >
        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-destructive">
          {resumen.etiquetaTerminal}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex max-w-full items-center gap-2 overflow-x-auto", className)}>
      <ol className="flex flex-nowrap items-center gap-1" aria-label="Ciclo de vida del documento">

      {resumen.pasos.map((paso, i) => {
        const completado = i < resumen.indiceActual;
        const actual = i === resumen.indiceActual;
        return (
          <li key={paso.id} className="flex items-center gap-1">
            <span
              aria-current={actual ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                actual && "border-accent bg-accent/10 text-accent",
                completado && "border-success/40 bg-success/10 text-success",
                !actual && !completado && "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              {completado ? <Check className="h-3 w-3" aria-hidden /> : null}
              {paso.label}
            </span>
            {i < resumen.pasos.length - 1 ? (
              <span className="h-px w-3 bg-border sm:w-5" aria-hidden />
            ) : null}
          </li>
        );
      })}
      </ol>
      {resumen.subEtiqueta ? (
        <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
          {resumen.subEtiqueta}
        </span>
      ) : null}
    </div>
  );
}
