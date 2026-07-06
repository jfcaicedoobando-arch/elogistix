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
 */
import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { useDrilldownRow } from "./useDrilldownRow";
import { cn } from "@/lib/utils";

interface Props extends Omit<HTMLAttributes<HTMLElement>, "role" | "tabIndex" | "onClick" | "onKeyDown"> {
  href: string | null | undefined;
  ariaLabel?: string;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

export const DrilldownRow = forwardRef<HTMLElement, Props>(function DrilldownRow(
  { href, ariaLabel, as: As = "div", className, children, ...rest },
  ref,
) {
  const nav = useDrilldownRow({ href, ariaLabel });
  return (
    <As ref={ref} {...rest} {...nav} className={cn(nav.className, className)}>
      {children}
    </As>
  );
});
