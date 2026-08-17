import type { KeyboardEvent } from "react";

/**
 * Accesibilidad (auditoría T-11): las tarjetas y filas clicables usaban un
 * `<div onClick>` sin soporte de teclado, así que quien navega con Tab no
 * podía activarlas. `activableConTeclado()` devuelve las props mínimas para
 * volverlas operables: rol de botón, foco tabulable, anillo de foco visible y
 * activación con Enter o Espacio.
 *
 * Uso:
 *   <div {...activableConTeclado(() => navigate(url))} className="...">
 */
export function activableConTeclado(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      // Espacio hace scroll de página por defecto; Enter puede enviar forms.
      e.preventDefault();
      onActivate();
    },
    className: undefined as string | undefined,
  };
}

/** Clases de anillo de foco para elementos activables por teclado. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
