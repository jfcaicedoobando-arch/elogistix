/**
 * Aviso accionable para superficies públicas: además del mensaje, lista los
 * pasos concretos que la persona puede seguir para resolverlo.
 * No expone códigos técnicos ni `error.message` crudo.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AvisoAccionableProps {
  titulo: string;
  descripcion: string;
  /** Pasos concretos: "qué falta y cómo corregirlo". */
  pasos?: readonly string[];
  icon?: ReactNode;
  /** Acción opcional (botón/enlace) al final del aviso. */
  accion?: ReactNode;
  tono?: "neutral" | "error";
  className?: string;
}

export function AvisoAccionable({
  titulo,
  descripcion,
  pasos,
  icon,
  accion,
  tono = "neutral",
  className,
}: AvisoAccionableProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-5 text-left", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className={tono === "error" ? "text-destructive" : "text-muted-foreground"}>
            {icon}
          </span>
        )}
        <div className="space-y-2">
          <p className="font-semibold text-foreground">{titulo}</p>
          <p className="text-body text-muted-foreground">{descripcion}</p>
          {pasos && pasos.length > 0 && (
            <div className="space-y-1">
              <p className="text-body-sm font-medium uppercase tracking-wide text-muted-foreground">
                Qué puedes hacer
              </p>
              <ul className="list-disc pl-5 text-body text-muted-foreground space-y-1">
                {pasos.map((paso) => (
                  <li key={paso}>{paso}</li>
                ))}
              </ul>
            </div>
          )}
          {accion && <div className="pt-1">{accion}</div>}
        </div>
      </div>
    </div>
  );
}
