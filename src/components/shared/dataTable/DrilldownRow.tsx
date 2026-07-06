/**
 * `<DrilldownRow>` — helper para list-items tipo card que se comportan como
 * filas de tabla (una card por registro con navegación por drilldown).
 *
 * Encapsula `useDrilldownRow` + `cn(className)` para no repetir el patrón en
 * cada componente. Ideal para cards / list-items dentro de dashboards del CRM,
 * portal cliente, tesorería, operaciones, etc.
 *
 * Uso:
 *   <DrilldownRow href={`/embarques/${e.id}`} ariaLabel={`Ver ${e.expediente}`} className="flex ...">
 *     ...contenido...
 *   </DrilldownRow>
 *
 * - `role="link"`, `tabIndex=0`, Enter/Space, Ctrl/Cmd+click, click medio.
 * - Ignora automáticamente controles internos (buttons, inputs, menús).
 * - Si `href` es null/undefined, degrada a `<div>` normal sin navegación.
 * - `onActivate` se ejecuta cuando la fila navega (útil para cerrar diálogos
 *   antes/al navegar). Recibe el evento sintético original.
 */
import {
  forwardRef,
  type ElementType,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useDrilldownRow } from "./useDrilldownRow";
import { cn } from "@/lib/utils";

interface Props extends Omit<HTMLAttributes<HTMLElement>, "role" | "tabIndex" | "onKeyDown"> {
  href: string | null | undefined;
  ariaLabel?: string;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  /** Callback opcional que se ejecuta cuando el usuario activa la fila. */
  onActivate?: () => void;
}

export const DrilldownRow = forwardRef<HTMLElement, Props>(function DrilldownRow(
  { href, ariaLabel, as: As = "div", className, children, onActivate, onClick, ...rest },
  ref,
) {
  const nav = useDrilldownRow({ href, ariaLabel });

  const composedOnClick = (e: MouseEvent<HTMLElement>) => {
    onClick?.(e);
    onActivate?.();
    nav.onClick?.(e);
  };

  return (
    <As
      ref={ref}
      {...rest}
      {...nav}
      onClick={composedOnClick}
      className={cn(nav.className, className)}
    >
      {children}
    </As>
  );
});
