/**
 * `<Spinner />` — wrapper canónico de `Loader2` con escala fija de 3 tamaños.
 *
 * Auditoría UI/UX (UX-14): antes convivían 7 tamaños de `Loader2`
 * (`h-3`, `h-3.5`, `h-4`, `h-5`, `h-6`, `h-8` y sin tamaño) entre pantallas
 * equivalentes. La escala queda fijada en:
 *
 *  - `inline` → `h-4 w-4`  (botones, texto en línea)
 *  - `block`  → `h-6 w-6`  (cards y secciones)
 *  - `page`   → `h-8 w-8`  (estados de página; ver también `LoadingState`)
 *
 * Uso: `<Spinner size="inline" />`. Para nuevos desarrollos, preferir este
 * wrapper sobre `<Loader2 className="… animate-spin" />` ad-hoc.
 */
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps {
  /** Tamaño dentro de la escala canónica. Default: `inline`. */
  size?: "inline" | "block" | "page";
  /** Clases extra (p.ej. color o márgenes). */
  className?: string;
  /** Texto accesible; si se omite, el spinner es decorativo (`aria-hidden`). */
  label?: string;
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  inline: "h-4 w-4",
  block: "h-6 w-6",
  page: "h-8 w-8",
};

export function Spinner({ size = "inline", className, label }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin", SIZE_CLASSES[size], className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  );
}
