import { type ReactNode, type MouseEventHandler } from "react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  /** Acción al pulsar (navegar, abrir modal, etc.). */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Icono principal (típicamente <Plus className="h-6 w-6" />). */
  icon: ReactNode;
  /** Etiqueta accesible — obligatoria para screen readers. */
  label: string;
  /** Mostrar el label como texto a la derecha del icono. Por defecto solo icono (FAB circular). */
  showLabel?: boolean;
  className?: string;
}

/**
 * Botón flotante de acción primaria, anclado al esquina inferior derecha del viewport.
 *
 * v8.99.41 — Pensado para vistas mobile (`<md`) donde los botones primarios full-width
 * compiten visualmente con el contenido. Se oculta automáticamente en `md+` mediante
 * `md:hidden` para evitar duplicar acciones que ya viven en el header en escritorio.
 *
 * Convenciones:
 *  - Posición fija: `bottom-6 right-4` (deja espacio para gestos del sistema en iOS).
 *  - Tamaño: 56x56 (estándar Material), `rounded-full`, sombra `shadow-overlay`.
 *  - Z-index 40 — debajo de `Sheet` overlay (50) pero sobre el contenido.
 *  - Tono: usa el primary del tema, asegurando contraste en light/dark.
 */
export function FloatingActionButton({
  onClick, icon, label, showLabel = false, className,
}: FloatingActionButtonProps) {
  return (
    <>
      {/* v13.823.25: reserva de espacio para que el FAB no tape el último
          renglón de la lista en móvil. */}
      <div aria-hidden className="md:hidden h-20" />

      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "md:hidden fixed right-4 z-40",
          // Respeta safe-area de iOS (home indicator) en 20:9 / iPhone con notch.
          "bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]",
          "inline-flex items-center justify-center gap-2",
          "h-14 min-w-14 px-4",
          "rounded-full bg-primary text-primary-foreground",
          "shadow-overlay ring-1 ring-primary/30",
          "transition-transform active:scale-95 hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        {icon}
        {showLabel && <span className="text-body font-semibold pr-1">{label}</span>}
      </button>
    </>
  );
}

