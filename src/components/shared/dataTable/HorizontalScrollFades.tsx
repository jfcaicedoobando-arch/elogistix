import { cn } from "@/lib/utils";

/**
 * Degradados a los bordes horizontales cuando la tabla tiene overflow.
 * Extraído de `DataTable` (v13.301.74a) para mantener el archivo principal
 * bajo el límite de 200 líneas del Power of 10. Puramente visuales; no
 * interceptan interacciones (pointer-events-none).
 */
export function HorizontalScrollFades({
  overflowing,
  atStart,
  atEnd,
}: {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
}) {
  const showLeft = overflowing && !atStart;
  const showRight = overflowing && !atEnd;
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity duration-150",
          showLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity duration-150",
          showRight ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}
