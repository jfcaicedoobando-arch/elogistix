/**
 * FaltantesHint — v13.312.27 (QW6 Tanda 2).
 * Muestra en línea qué campos requeridos faltan cuando el botón de submit
 * de un diálogo está `disabled`. No reemplaza validación real; sólo da
 * feedback inmediato al usuario mientras rellena el formulario.
 *
 * Analogía: el botón "Guardar" en gris ya no queda mudo — dice "faltan
 * cliente y fecha", como una lista de compras pegada en la puerta.
 */
import { AlertCircle } from "lucide-react";

interface Props {
  /** Etiquetas humanas de los campos faltantes. Vacío = no renderiza nada. */
  items: ReadonlyArray<string>;
  className?: string;
}

export function FaltantesHint({ items, className }: Props) {
  if (items.length === 0) return null;
  return (
    <p
      className={
        "flex items-start gap-1.5 text-xs text-warning-foreground/90 " +
        (className ?? "")
      }
      role="status"
      aria-live="polite"
    >
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>
        <span className="font-medium">Falta:</span>{" "}
        {items.join(" · ")}
      </span>
    </p>
  );
}
